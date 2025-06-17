from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, viewsets, permissions 
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.shortcuts import render
from django.contrib.auth import authenticate, login, logout
from .models import CustomUser,Task, Goal, AISummary
from .serializers import UserSerializer, LoginSerializer, GoalSerializer, TaskSerializer, AISummarySerializer
from django.views.decorators.http import require_GET
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
import openai
import os
import tempfile
import PyPDF2

# Create your views here.
def home(request):
    return render(request, "index.html")

@require_GET
def csrf_token(request):
    # Generate a new CSRF token (this also sets it in the request session)
    csrf_token = get_token(request)
    # Create the response and explicitly set the CSRF cookie
    response = JsonResponse({'csrfToken': csrf_token})
    
    # Match cookie settings to Django's defaults (adjust if you've customized these)
    response.set_cookie(
        'csrftoken',
        csrf_token, 
        max_age= 31449600,  # 1 year (Django's default)
        secure= settings.CSRF_COOKIE_SECURE,
        httponly= False,  # CSRF tokens are typically accessible via JS
        samesite= settings.CSRF_COOKIE_SAMESITE  # Match your security requirements
    )
    return response

class UserDetailsView(APIView):
    """Get details of the currently authenticated user"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        # Customize this based on your User model fields
        data = {
            'user': {
                'email': user.email,
                'username': user.username,
                'has_profile': hasattr(user, 'profile')
            }
        }
        return Response(data, status=status.HTTP_200_OK)


class LoginView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data.get('email')
        password = serializer.validated_data.get('password')

        # First check if user exists
        try:
            user = CustomUser.objects.get(email=email)
        except CustomUser.DoesNotExist:
            return Response(
                {'error': 'No account found with this email'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        user = authenticate(request, username=email, password=password)

        if user is None:
            return Response(
                {'error': 'Invalid credentials'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        if not user.is_active:
            return Response(
                {'error': 'Account is not active'},
                status=status.HTTP_403_FORBIDDEN
            )

        login(request, user)
        return Response({
            'message': 'Login successful',
            'user': {
                'email': user.email,
                'username': user.username
            }
        }, status=status.HTTP_200_OK)
    

class SignupView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        serializer = UserSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        if CustomUser.objects.filter(email=serializer.validated_data['email']).exists():
            return Response(
                {'error': 'Email already exists'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if CustomUser.objects.filter(username=serializer.validated_data['username']).exists():
            return Response(
                {'error': 'Username already exists'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = CustomUser.objects.create_user(
            email=serializer.validated_data['email'],
            username=serializer.validated_data['username'],
            password=serializer.validated_data['password']
        )

        return Response({
            'message': 'User created successfully',
            'user': {
                'email': user.email,
                'username': user.username
            }
        }, status=status.HTTP_201_CREATED)
    

class LogoutView(APIView):
    """Handle user logout"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Clear session data
        logout(request)
        # Add additional cleanup if needed
        return Response(
            {'detail': 'Successfully logged out.'},
            status=status.HTTP_200_OK
        )
    

class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Task.objects.none()

    def get_queryset(self):
        return Task.objects.filter(user=self.request.user).select_related('user')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class GoalViewSet(viewsets.ModelViewSet):   
    serializer_class = GoalSerializer
    permission_classes = [permissions.IsAuthenticated]
   
    def get_queryset(self):
        """Only return goals belonging to the current user"""
        return Goal.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        """Associate the goal with the current user on creation"""
        serializer.save(user=self.request.user)


    @action(detail=True, methods=['post'])
    def add_progress(self, request, pk=None):
        """
        Add progress to today's daily goal (task-level tracking)
        """
        goal = self.get_object()
        amount = request.data.get('amount', 1)
        
        # Validate amount
        if not isinstance(amount, int) or amount < 1:
            return Response({
                'error': 'Amount must be a positive integer'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if amount > 20:  # Reasonable upper limit
            return Response({
                'error': 'Amount too large'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Add progress using model method
        goal.add_daily_progress(amount)
        
        return Response({
            'status': 'success',
            'message': f'Added {amount} to daily progress',
            'daily_progress': goal.daily_progress,
            'daily_target': goal.daily_target,
            'is_daily_goal_completed': goal.is_daily_goal_completed(),
            'daily_completion_triggered': goal.daily_progress >= goal.daily_target
        })
    
    @action(detail=True, methods=['post'])
    def subtract_progress(self, request, pk=None):
        """
        Subtract progress (for corrections)
        """
        goal = self.get_object()
        amount = request.data.get('amount', 1)
        
        goal.reset_daily_progress_if_new_day()
        old_progress = goal.daily_progress
        goal.daily_progress = max(0, goal.daily_progress - amount)
        
        # If progress falls below daily target, remove today from completed days
        if old_progress >= goal.daily_target and goal.daily_progress < goal.daily_target:
            today = timezone.now().date()
            today_weekday = today.weekday()  # 0 = Monday, 6 = Sunday
            if today_weekday in goal.current_week_days_completed:
                goal.current_week_days_completed.remove(today_weekday)
                goal.update_weekly_streak()
        
        goal.save()
        
        return Response({
            'status': 'success',
            'message': f'Subtracted {amount} from daily progress',
            'daily_progress': goal.daily_progress,
            'daily_target': goal.daily_target,
            'is_daily_goal_completed': goal.is_daily_goal_completed(),
            'weekly_streak': goal.weekly_streak,
            'current_week_days_completed': goal.current_week_days_completed,
            'days_completed_this_week': len(goal.current_week_days_completed),
            'is_week_completed': goal.is_week_completed()
        })

    @action(detail=True, methods=['post'])
    def mark_daily_goal_completed(self, request, pk=None):
        """
        Endpoint to mark a daily goal as completed for today
        """
        goal = self.get_object()
        today = timezone.now().date()
        
        # Use the model's method to add completed day
        goal.add_completed_day(today)
        
        return Response({
            'status': 'success',
            'message': 'Daily goal marked as completed',
            'weekly_streak': goal.weekly_streak,
            'current_week_days_completed': goal.current_week_days_completed,
            'days_completed_this_week': len(goal.current_week_days_completed),
            'is_week_completed': goal.is_week_completed(),
            'last_completed_date': goal.last_completed_date,
            'current_week_start': goal.current_week_start
        })


    @action(detail=True, methods=['post'])
    def remove_completed_day(self, request, pk=None):
        """
        Remove today from completed days (undo completion)
        """
        goal = self.get_object()
        today = timezone.now().date()
        today_weekday = today.weekday()  # 0 = Monday, 6 = Sunday
        
        if today_weekday in goal.current_week_days_completed:
            goal.current_week_days_completed.remove(today_weekday)
            
            # Update weekly streak after removal
            goal.update_weekly_streak()
            goal.save()
            
            return Response({
                'status': 'success',
                'message': 'Daily goal completion removed',
                'weekly_streak': goal.weekly_streak,
                'days_completed_this_week': len(goal.current_week_days_completed),
                'is_week_completed': goal.is_week_completed()
            })
        else:
            return Response({
                'error': 'Today was not marked as completed'
            }, status=status.HTTP_400_BAD_REQUEST)


class AISummaryViewSet(viewsets.ModelViewSet):
    """
    ViewSet for handling AI summaries with custom actions
    Provides CRUD operations plus custom actions for AI processing
    """
    serializer_class = AISummarySerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        """Return summaries for the authenticated user only"""
        return AISummary.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        """Ensure the summary is associated with the current user"""
        serializer.save(user=self.request.user)


    @action(detail=False, methods=['post'])
    def generate_summary(self, request):
        """
        Generate AI summary from text
        POST /api/summaries/generate_summary/
        
        Expected payload:
        {
            "text": "Text to summarize",
            "source_type": "text" // optional, defaults to "text"
        }
        """
        text = request.data.get('text')
        source_type = request.data.get('source_type', 'text')
        
        if not text:
            return Response(
                {'error': 'No text provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if len(text.strip()) < 50:
            return Response(
                {'error': 'Text too short. Please provide at least 50 characters.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Initialize OpenAI client
            client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
            
            # Generate summary using OpenAI
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {
                        "role": "system", 
                        "content": "You are a helpful study assistant. Create a concise and well-structured summary of the provided text. Focus on key concepts, main ideas, and important details. Format the summary with clear sections and bullet points where appropriate. Make it suitable for study purposes."
                    },
                    {
                        "role": "user", 
                        "content": f"Please summarize this {source_type} content:\n\n{text}"
                    }
                ],
                temperature=0.7,
                max_tokens=1000
            )

            summary_content = response.choices[0].message.content

            # Create summary object
            summary_obj = AISummary.objects.create(
                user=request.user,
                title=f"Summary {timezone.now().strftime('%Y-%m-%d %H:%M')}",
                content=summary_content,
                source_type=source_type,
                source_content=text[:5000]  # Store first 5000 chars
            )

            # Serialize the created object
            serializer = self.get_serializer(summary_obj)

            return Response({
                'message': 'Summary generated successfully',
                'summary': summary_content,
                'id': summary_obj.id,
                'title': summary_obj.title,
                'data': serializer.data
            }, status=status.HTTP_201_CREATED)

        except openai.OpenAIError as e:
            return Response(
                {'error': f'OpenAI API error: {str(e)}'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        except Exception as e:
            return Response(
                {'error': f'Failed to generate summary: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def upload_pdf(self, request):
        """
        Handle PDF file upload and processing
        POST /api/summaries/upload_pdf/
        
        Expected: multipart/form-data with 'file' field containing PDF
        """
        if 'file' not in request.FILES:
            return Response(
                {'error': 'No file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        file = request.FILES['file']
        
        # Validate file type
        if not file.name.lower().endswith('.pdf'):
            return Response(
                {'error': 'Only PDF files are allowed'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate file size (max 10MB)
        if file.size > 10 * 1024 * 1024:
            return Response(
                {'error': 'File size too large. Maximum size is 10MB.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Extract text from PDF
            text_content = self._extract_text_from_pdf(file)
            
            if not text_content.strip():
                return Response(
                    {'error': 'Could not extract text from PDF. Please ensure the PDF contains readable text.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if len(text_content.strip()) < 100:
                return Response(
                    {'error': 'PDF content too short for meaningful summarization.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Initialize OpenAI client
            client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
            
            # Generate summary using OpenAI
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {
                        "role": "system", 
                        "content": "You are a helpful study assistant. Create a comprehensive and well-structured summary of the provided PDF content. Focus on key concepts, main ideas, and important details. Format the summary with clear sections and bullet points where appropriate. Make it suitable for study purposes."
                    },
                    {
                        "role": "user", 
                        "content": f"Please summarize this PDF content:\n\n{text_content[:8000]}"  # Limit to avoid token limits
                    }
                ],
                temperature=0.7,
                max_tokens=1500
            )

            summary_content = response.choices[0].message.content

            # Create summary object
            summary_obj = AISummary.objects.create(
                user=request.user,
                title=f"Summary of {file.name}",
                content=summary_content,
                source_type='pdf',
                source_content=text_content[:5000]  # Store first 5000 chars of original content
            )

            # Serialize the created object
            serializer = self.get_serializer(summary_obj)

            return Response({
                'message': 'PDF processed successfully',
                'summary': summary_content,
                'id': summary_obj.id,
                'title': summary_obj.title,
                'filename': file.name,
                'data': serializer.data
            }, status=status.HTTP_201_CREATED)

        except openai.OpenAIError as e:
            return Response(
                {'error': f'OpenAI API error: {str(e)}'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        except Exception as e:
            return Response(
                {'error': f'Failed to process PDF: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def regenerate(self, request, pk=None):
        """
        Regenerate summary for an existing summary object
        POST /api/summaries/{id}/regenerate/
        """
        summary = self.get_object()
        
        if not summary.source_content:
            return Response(
                {'error': 'No source content available for regeneration'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Initialize OpenAI client
            client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
            
            # Generate new summary using OpenAI
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {
                        "role": "system", 
                        "content": "You are a helpful study assistant. Create a fresh, concise and well-structured summary of the provided content. Focus on key concepts, main ideas, and important details. Format the summary with clear sections and bullet points where appropriate."
                    },
                    {
                        "role": "user", 
                        "content": f"Please create a new summary of this {summary.source_type} content:\n\n{summary.source_content}"
                    }
                ],
                temperature=0.8,  # Slightly higher temperature for variation
                max_tokens=1200
            )

            new_summary_content = response.choices[0].message.content

            # Update the summary
            summary.content = new_summary_content
            summary.updated_at = timezone.now()
            summary.save()

            # Serialize the updated object
            serializer = self.get_serializer(summary)

            return Response({
                'message': 'Summary regenerated successfully',
                'summary': new_summary_content,
                'data': serializer.data
            }, status=status.HTTP_200_OK)

        except openai.OpenAIError as e:
            return Response(
                {'error': f'OpenAI API error: {str(e)}'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        except Exception as e:
            return Response(
                {'error': f'Failed to regenerate summary: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def recent(self, request):
        """
        Get recent summaries (last 10)
        GET /api/summaries/recent/
        """
        recent_summaries = self.get_queryset()[:10]
        serializer = self.get_serializer(recent_summaries, many=True)
        return Response({
            'count': len(recent_summaries),
            'results': serializer.data
        })

    @action(detail=False, methods=['get'])
    def by_type(self, request):
        """
        Get summaries filtered by source type
        GET /api/summaries/by_type/?type=text|pdf
        """
        source_type = request.query_params.get('type')
        if not source_type:
            return Response(
                {'error': 'Type parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if source_type not in ['text', 'pdf']:
            return Response(
                {'error': 'Type must be either "text" or "pdf"'},
                status=status.HTTP_400_BAD_REQUEST
            )

        filtered_summaries = self.get_queryset().filter(source_type=source_type)
        serializer = self.get_serializer(filtered_summaries, many=True)
        
        return Response({
            'count': len(filtered_summaries),
            'type': source_type,
            'results': serializer.data
        })

    @action(detail=False, methods=['delete'])
    def delete_all(self, request):
        """
        Delete all summaries for the current user
        DELETE /api/summaries/delete_all/
        """
        count = self.get_queryset().count()
        self.get_queryset().delete()
        
        return Response({
            'message': f'Successfully deleted {count} summaries',
            'deleted_count': count
        }, status=status.HTTP_200_OK)

    def _extract_text_from_pdf(self, file):
        """Extract text content from uploaded PDF file"""
        try:
            # Create a temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
                # Write the uploaded file content to temp file
                for chunk in file.chunks():
                    temp_file.write(chunk)
                temp_file_path = temp_file.name

            # Extract text using PyPDF2
            text_content = ""
            with open(temp_file_path, 'rb') as pdf_file:
                pdf_reader = PyPDF2.PdfReader(pdf_file)
                
                for page_num in range(len(pdf_reader.pages)):
                    page = pdf_reader.pages[page_num]
                    page_text = page.extract_text()
                    if page_text:
                        text_content += f"--- Page {page_num + 1} ---\n{page_text}\n\n"

            # Clean up temp file
            os.unlink(temp_file_path)
            
            return text_content.strip()

        except Exception as e:
            # Clean up temp file if it exists
            if 'temp_file_path' in locals():
                try:
                    os.unlink(temp_file_path)
                except:
                    pass
            raise Exception(f"Error extracting text from PDF: {str(e)}")
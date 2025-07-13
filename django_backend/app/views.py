from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, viewsets, permissions 
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import api_view, permission_classes, action
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.shortcuts import render
from django.contrib.auth import authenticate, login, logout
from .models import CustomUser,Task, Goal, DSAAIResponse, SoftwareDevAIResponse, SystemDesignAIResponse, JobSearchAIResponse
from .serializers import UserSerializer, LoginSerializer, GoalSerializer, TaskSerializer, DSAAIResponseSerializer, SoftwareDevAIResponseSerializer, SystemDesignAIResponseSerializer, JobSearchAIResponseSerializer
from django.views.decorators.http import require_GET
from django.http import JsonResponse, HttpResponseNotFound
from django.middleware.csrf import get_token
from django.conf import settings
from django.utils import timezone
import google.generativeai as genai
from .throttles import AIGenerationThrottle, AIRegenerationThrottle

try:
    genai.configure(api_key=settings.GEMINI_API_KEY)
except AttributeError:
    # Handle case where GEMINI_API_KEY might not be set during certain operations (e.g., collectstatic)
    print("GEMINI_API_KEY not found in settings. AI features will be disabled.")
    pass

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


class DSAAIResponseViewSet(viewsets.ModelViewSet):
    """
    ViewSet for handling DSA AI Responses with user scoping and custom actions.
    Provides CRUD operations plus custom actions for filtering.
    """
    serializer_class = DSAAIResponseSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        """Return DSA responses for the authenticated user only"""
        return DSAAIResponse.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        """Ensure the response is associated with the current user"""
        serializer.save(user=self.request.user)


    @action(detail=False, methods=['post'], throttle_classes=[AIGenerationThrottle])
    def generate_response(self, request):
        """
        Generate a DSA AI response using Gemini.
        POST /api/dsa-ai-responses/generate_response/
        """
        question = request.data.get('question')
        topic_tags = request.data.get('topic_tags', '')
        difficulty = request.data.get('difficulty', 'unknown')
        problem_source = request.data.get('problem_source', '')
        problem_id = request.data.get('problem_id', '')

        if not question or len(question.strip()) < 10:
            return Response({'error': 'A valid DSA question is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Fetch user's DSA tasks
            user_tasks = Task.objects.filter(user=request.user, category='dsa')
            if user_tasks.exists():
                tasks_summary = "\n".join([
                    f"- {task.title} | {'Completed' if task.completed else 'Incomplete'}"
                    f" | Due: {task.due_date if task.due_date else 'N/A'}"
                    f"\n  {task.description[:100]}{'...' if len(task.description) > 100 else ''}"
                    for task in user_tasks
                ])
                tasks_section = f"User's DSA Tasks:\n{tasks_summary}\n\n"
            else:
                tasks_section = "User has no DSA tasks.\n\n"

            # Compose prompt for Gemini
            prompt = (
                f"{tasks_section}"
                "You are a DSA Expert with 10+ years of experience in competitive programming and technical interviews. "
                "Your expertise includes advanced algorithms and data structures, time/space complexity analysis, "
                "problem-solving patterns and techniques, optimization strategies, and code implementation in multiple languages.\n\n"
                "When responding, you must:\n"
                "- Always analyze time and space complexity\n"
                "- Explain the intuition behind the approach\n"
                "- Provide multiple solutions when possible (brute force → optimized)\n"
                "- Include visual representations or step-by-step walkthroughs\n"
                "- Mention relevant patterns (sliding window, two pointers, etc.)\n"
                "- Connect problems to real-world applications\n\n"
                "FORMATTING REQUIREMENTS - Format your response using clean markdown with:\n"
                "- Use ## for main headings\n"
                "- Use **bold** for important concepts (NOT asterisks)\n"
                "- Use ```python for code blocks with syntax highlighting\n"
                "- Use - for bullet points\n"
                "- Add proper paragraph spacing\n"
                "- Do NOT use asterisks (*) anywhere in your response\n"
                "- Structure your response with clear sections\n"
                "- Keep formatting simple and clean\n\n"
                "Structure your response with these sections:\n"
                "1. ## Problem Understanding\n"
                "2. ## Approach and Intuition\n"
                "3. ## Solution(s) - start with brute force if applicable, then optimized\n"
                "4. ## Complexity Analysis\n"
                "5. ## Pattern Recognition\n"
                "6. ## Real-world Applications (if applicable)\n\n"
                f"Question: {question}"
            )
            # Call Gemini API (replace with your actual call)
            model = genai.GenerativeModel(settings.GEMINI_MODEL_NAME)
            response = model.generate_content(prompt)
            ai_response = response.text
            ai_response = clean_ai_response(ai_response)  # Clean the response

            # Save to DB
            dsa_obj = DSAAIResponse.objects.create(
                user=request.user,
                question=question,
                response=ai_response,
                topic_tags=topic_tags,
                difficulty=difficulty,
                problem_source=problem_source,
                problem_id=problem_id,
                created_at=timezone.now(),
                updated_at=timezone.now(),
            )
            serializer = self.get_serializer(dsa_obj)
            return Response({
                'message': 'DSA response generated successfully',
                'response': ai_response,
                'data': serializer.data
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': f'AI model error: {str(e)}'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


    @action(detail=False, methods=['get'])
    def by_difficulty(self, request):
        """
        Get DSA responses filtered by difficulty.
        GET /api/dsa-ai-responses/by_difficulty/?difficulty=easy|medium|hard|unknown
        """
        difficulty = request.query_params.get('difficulty')
        if not difficulty:
            return Response(
                {'error': 'Difficulty parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if difficulty not in dict(DSAAIResponse.DIFFICULTY_CHOICES):
            return Response(
                {'error': f'Invalid difficulty. Must be one of: {", ".join(dict(DSAAIResponse.DIFFICULTY_CHOICES).keys())}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        filtered = self.get_queryset().filter(difficulty=difficulty)
        serializer = self.get_serializer(filtered, many=True)
        return Response({
            'count': len(filtered),
            'difficulty': difficulty,
            'results': serializer.data
        })

    @action(detail=False, methods=['get'])
    def by_topic(self, request):
        """
        Get DSA responses filtered by topic tag.
        GET /api/dsa-ai-responses/by_topic/?tag=arrays
        """
        tag = request.query_params.get('tag')
        if not tag:
            return Response(
                {'error': 'Tag parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        filtered = [resp for resp in self.get_queryset() if tag in resp.get_topic_tags_list()]
        serializer = self.get_serializer(filtered, many=True)
        return Response({
            'count': len(filtered),
            'tag': tag,
            'results': serializer.data
        })

    @action(detail=True, methods=['post'], throttle_classes = [AIRegenerationThrottle])
    def regenerate(self, request, pk=None):
        """
        Regenerate the AI response for a given DSA response object.
        POST /api/dsa-ai-responses/<id>/regenerate/
        """
        instance = self.get_object()
        try:
            # Compose the prompt as in generate_response
            user_tasks = Task.objects.filter(user=request.user, category='dsa')
            if user_tasks.exists():
                tasks_summary = "\n".join([
                    f"- {task.title} | {'Completed' if task.completed else 'Incomplete'}"
                    f" | Due: {task.due_date if task.due_date else 'N/A'}"
                    f"\n  {task.description[:100]}{'...' if len(task.description) > 100 else ''}"
                    for task in user_tasks
                ])
                tasks_section = f"User's DSA Tasks:\n{tasks_summary}\n\n"
            else:
                tasks_section = "User has no DSA tasks.\n\n"

            prompt = (
                f"{tasks_section}"
                "You are a DSA Expert with 10+ years of experience in competitive programming and technical interviews. "
                "Your expertise includes advanced algorithms and data structures, time/space complexity analysis, "
                "problem-solving patterns and techniques, optimization strategies, and code implementation in multiple languages.\n\n"
                "When responding, you must:\n"
                "- Always analyze time and space complexity\n"
                "- Explain the intuition behind the approach\n"
                "- Provide multiple solutions when possible (brute force → optimized)\n"
                "- Include visual representations or step-by-step walkthroughs\n"
                "- Mention relevant patterns (sliding window, two pointers, etc.)\n"
                "- Connect problems to real-world applications\n\n"
                "FORMATTING REQUIREMENTS - Format your response using clean markdown with:\n"
                "- Use ## for main headings\n"
                "- Use **bold** for important concepts (NOT asterisks)\n"
                "- Use ```python for code blocks with syntax highlighting\n"
                "- Use - for bullet points\n"
                "- Add proper paragraph spacing\n"
                "- Do NOT use asterisks (*) anywhere in your response\n"
                "- Structure your response with clear sections\n"
                "- Keep formatting simple and clean\n\n"
                "Structure your response with these sections:\n"
                "1. ## Problem Understanding\n"
                "2. ## Approach and Intuition\n"
                "3. ## Solution(s) - start with brute force if applicable, then optimized\n"
                "4. ## Complexity Analysis\n"
                "5. ## Pattern Recognition\n"
                "6. ## Real-world Applications (if applicable)\n\n"
                f"Question: {instance.question}"
            )
            model = genai.GenerativeModel(settings.GEMINI_MODEL_NAME)
            response = model.generate_content(prompt)
            ai_response = response.text
            ai_response = clean_ai_response(ai_response)

            # Update the instance
            instance.response = ai_response
            instance.updated_at = timezone.now()
            instance.save()

            return Response({
                'message': 'Response regenerated successfully',
                'response': ai_response
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': f'AI model error: {str(e)}'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

class SoftwareDevAIResponseViewSet(viewsets.ModelViewSet):
    """
    ViewSet for handling Software Development AI Responses with user scoping and custom actions.
    Provides CRUD operations plus custom actions for filtering and AI generation.
    """
    serializer_class = SoftwareDevAIResponseSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        """Return dev responses for the authenticated user only"""
        return SoftwareDevAIResponse.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        """Ensure the response is associated with the current user"""
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['post'], throttle_classes=[AIGenerationThrottle])
    def generate_response(self, request):
        """
        Generate a Software Dev AI response using Gemini.
        POST /api/software-dev-ai-responses/generate_response/
        """
        question = request.data.get('question')
        topic_tags = request.data.get('topic_tags', '')
        tech_stack = request.data.get('tech_stack', 'other')
        programming_language = request.data.get('programming_language', '')
        framework = request.data.get('framework', '')
        question_type = request.data.get('question_type', 'other')

        if not question or len(question.strip()) < 10:
            return Response({'error': 'A valid development question is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Fetch user's Development tasks
            user_tasks = Task.objects.filter(user=request.user, category='development')
            if user_tasks.exists():
                tasks_summary = "\n".join([
                    f"- {task.title} | {'Completed' if task.completed else 'Incomplete'}"
                    f" | Due: {task.due_date if task.due_date else 'N/A'}"
                    f"\n  {task.description[:100]}{'...' if len(task.description) > 100 else ''}"
                    for task in user_tasks
                ])
                tasks_section = f"User's Development Tasks:\n{tasks_summary}\n\n"
            else:
                tasks_section = "User has no Development tasks.\n\n"

            prompt = (
                f"{tasks_section}"
                "You are a Senior Software Development Specialist with 10+ years of experience in enterprise-level applications. "
                "Your expertise includes full-stack development (frontend, backend, databases), software architecture and design patterns, "
                "code quality, testing, and best practices, DevOps and deployment strategies, performance optimization, and security considerations.\n\n"
                "When responding, you must:\n"
                "- Follow SOLID principles and clean code practices\n"
                "- Consider scalability, maintainability, and performance\n"
                "- Suggest appropriate design patterns\n"
                "- Include error handling and edge cases\n"
                "- Recommend testing strategies\n"
                "- Consider security implications\n"
                "- Provide production-ready solutions\n\n"
                "FORMATTING REQUIREMENTS - Format your response using clean markdown with:\n"
                "- Use ## for main headings\n"
                "- Use **bold** for important concepts (NOT asterisks)\n"
                "- Use ```javascript or ```python for code blocks with syntax highlighting\n"
                "- Use - for bullet points\n"
                "- Add proper paragraph spacing\n"
                "- Do NOT use asterisks (*) anywhere in your response\n"
                "- Include best practices and explanations where appropriate\n\n"
                "Structure your response with these sections:\n"
                "1. ## Problem Analysis\n"
                "2. ## Solution Architecture\n"
                "3. ## Implementation\n"
                "4. ## Best Practices & Design Patterns\n"
                "5. ## Error Handling & Edge Cases\n"
                "6. ## Testing Strategy\n"
                "7. ## Security Considerations\n"
                "8. ## Performance & Scalability\n\n"
                f"Question: {question}"
            )
            model = genai.GenerativeModel(settings.GEMINI_MODEL_NAME)
            response = model.generate_content(prompt)
            ai_response = response.text
            ai_response = clean_ai_response(ai_response)  # Clean the response

            dev_obj = SoftwareDevAIResponse.objects.create(
                user=request.user,
                question=question,
                response=ai_response,
                topic_tags=topic_tags,
                tech_stack=tech_stack,
                programming_language=programming_language,
                framework=framework,
                question_type=question_type,
                created_at=timezone.now(),
                updated_at=timezone.now(),
            )
            serializer = self.get_serializer(dev_obj)
            return Response({
                'message': 'Development response generated successfully',
                'response': ai_response,
                'data': serializer.data
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': f'AI model error: {str(e)}'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    @action(detail=False, methods=['get'])
    def by_tech_stack(self, request):
        """
        Get responses filtered by tech_stack.
        GET /api/software-dev-ai-responses/by_tech_stack/?tech_stack=frontend|backend|fullstack|mobile|devops|database|other
        """
        tech_stack = request.query_params.get('tech_stack')
        if not tech_stack:
            return Response(
                {'error': 'tech_stack parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        valid_choices = dict(SoftwareDevAIResponse.TECH_STACK_CHOICES)
        if tech_stack not in valid_choices:
            return Response(
                {'error': f'Invalid tech_stack. Must be one of: {', '.join(valid_choices.keys())}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        filtered = self.get_queryset().filter(tech_stack=tech_stack)
        serializer = self.get_serializer(filtered, many=True)
        return Response({
            'count': len(filtered),
            'tech_stack': tech_stack,
            'results': serializer.data
        })

    @action(detail=False, methods=['get'])
    def by_topic(self, request):
        """
        Get responses filtered by topic tag.
        GET /api/software-dev-ai-responses/by_topic/?tag=react
        """
        tag = request.query_params.get('tag')
        if not tag:
            return Response(
                {'error': 'Tag parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        filtered = [resp for resp in self.get_queryset() if tag in resp.get_topic_tags_list()]
        serializer = self.get_serializer(filtered, many=True)
        return Response({
            'count': len(filtered),
            'tag': tag,
            'results': serializer.data
        })

    @action(detail=True, methods=['post'], throttle_classes = [AIRegenerationThrottle])
    def regenerate(self, request, pk=None):
        """
        Regenerate the AI response for a given Software Development response object.
        POST /api/software-dev-ai-responses/<id>/regenerate/
        """
        instance = self.get_object()
        try:
            # Compose the prompt as in generate_response
            user_tasks = Task.objects.filter(user=request.user, category='development')
            if user_tasks.exists():
                tasks_summary = "\n".join([
                    f"- {task.title} | {'Completed' if task.completed else 'Incomplete'}"
                    f" | Due: {task.due_date if task.due_date else 'N/A'}"
                    f"\n  {task.description[:100]}{'...' if len(task.description) > 100 else ''}"
                    for task in user_tasks
                ])
                tasks_section = f"User's Development Tasks:\n{tasks_summary}\n\n"
            else:
                tasks_section = "User has no Development tasks.\n\n"

            prompt = (
                f"{tasks_section}"
                "You are a Senior Software Development Specialist with 10+ years of experience in enterprise-level applications. "
                "Your expertise includes full-stack development (frontend, backend, databases), software architecture and design patterns, "
                "code quality, testing, and best practices, DevOps and deployment strategies, performance optimization, and security considerations.\n\n"
                "When responding, you must:\n"
                "- Follow SOLID principles and clean code practices\n"
                "- Consider scalability, maintainability, and performance\n"
                "- Suggest appropriate design patterns\n"
                "- Include error handling and edge cases\n"
                "- Recommend testing strategies\n"
                "- Consider security implications\n"
                "- Provide production-ready solutions\n\n"
                "FORMATTING REQUIREMENTS - Format your response using clean markdown with:\n"
                "- Use ## for main headings\n"
                "- Use **bold** for important concepts (NOT asterisks)\n"
                "- Use ```javascript or ```python for code blocks with syntax highlighting\n"
                "- Use - for bullet points\n"
                "- Add proper paragraph spacing\n"
                "- Do NOT use asterisks (*) anywhere in your response\n"
                "- Include best practices and explanations where appropriate\n\n"
                "Structure your response with these sections:\n"
                "1. ## Problem Analysis\n"
                "2. ## Solution Architecture\n"
                "3. ## Implementation\n"
                "4. ## Best Practices & Design Patterns\n"
                "5. ## Error Handling & Edge Cases\n"
                "6. ## Testing Strategy\n"
                "7. ## Security Considerations\n"
                "8. ## Performance & Scalability\n\n"
                f"Question: {instance.question}"
            )
            model = genai.GenerativeModel(settings.GEMINI_MODEL_NAME)
            response = model.generate_content(prompt)
            ai_response = response.text
            ai_response = clean_ai_response(ai_response)

            # Update the instance
            instance.response = ai_response
            instance.updated_at = timezone.now()
            instance.save()

            return Response({
                'message': 'Response regenerated successfully',
                'response': ai_response
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': f'AI model error: {str(e)}'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

class SystemDesignAIResponseViewSet(viewsets.ModelViewSet):
    """
    ViewSet for handling System Design AI Responses with user scoping and custom actions.
    Provides CRUD operations plus custom actions for filtering and AI generation.
    """
    serializer_class = SystemDesignAIResponseSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        return SystemDesignAIResponse.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['post'], throttle_classes=[AIGenerationThrottle])
    def generate_response(self, request):
        question = request.data.get('question')
        topic_tags = request.data.get('topic_tags', '')
        system_scale = request.data.get('system_scale', 'unknown')
        system_type = request.data.get('system_type', 'other')
        focus_area = request.data.get('focus_area', 'architecture')
        is_interview_prep = request.data.get('is_interview_prep', False)
        company_context = request.data.get('company_context', '')

        if not question or len(question.strip()) < 10:
            return Response({'error': 'A valid system design question is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Fetch user's System Design tasks
            user_tasks = Task.objects.filter(user=request.user, category='system_design')
            if user_tasks.exists():
                tasks_summary = "\n".join([
                    f"- {task.title} | {'Completed' if task.completed else 'Incomplete'}"
                    f" | Due: {task.due_date if task.due_date else 'N/A'}"
                    f"\n  {task.description[:100]}{'...' if len(task.description) > 100 else ''}"
                    for task in user_tasks
                ])
                tasks_section = f"User's System Design Tasks:\n{tasks_summary}\n\n"
            else:
                tasks_section = "User has no System Design tasks.\n\n"

            prompt = (
                f"{tasks_section}"
                "You are a System Design Expert specializing in large-scale distributed systems with 15+ years of experience "
                "in designing systems for companies like Google, Amazon, and Netflix. Your expertise includes scalable architecture design, "
                "database design and selection (SQL/NoSQL), microservices vs monolith decisions, load balancing and caching strategies, "
                "message queues and event-driven architecture, performance optimization and bottleneck identification, "
                "fault tolerance and disaster recovery.\n\n"
                "When responding, you must:\n"
                "- Start with requirements gathering and constraints\n"
                "- Consider scalability from day one\n"
                "- Discuss trade-offs between different approaches\n"
                "- Include capacity estimation and bottleneck analysis\n"
                "- Address availability, consistency, and partition tolerance (CAP theorem)\n"
                "- Provide diagrams or architectural overviews when helpful\n"
                "- Consider both technical and business constraints\n\n"
                "FORMATTING REQUIREMENTS - Format your response using clean markdown with:\n"
                "- Use ## for main headings\n"
                "- Use **bold** for important concepts (NOT asterisks)\n"
                "- Use ``` for code examples and configuration\n"
                "- Use - for bullet points\n"
                "- Add proper paragraph spacing\n"
                "- Do NOT use asterisks (*) anywhere in your response\n"
                "- Include diagrams or visual aids where appropriate\n\n"
                "Structure your response with these sections:\n"
                "1. ## Requirements Analysis\n"
                "2. ## System Constraints & Scale Estimation\n"
                "3. ## High-Level Architecture\n"
                "4. ## Database Design\n"
                "5. ## API Design\n"
                "6. ## Scalability & Performance\n"
                "7. ## Reliability & Fault Tolerance\n"
                "8. ## Technology Stack & Trade-offs\n"
                "9. ## Monitoring & Observability\n\n"
                f"Question: {question}"
            )
            model = genai.GenerativeModel(settings.GEMINI_MODEL_NAME)
            response = model.generate_content(prompt)
            ai_response = response.text
            ai_response = clean_ai_response(ai_response)  # Clean the response

            obj = SystemDesignAIResponse.objects.create(
                user=request.user,
                question=question,
                response=ai_response,
                topic_tags=topic_tags,
                system_scale=system_scale,
                system_type=system_type,
                focus_area=focus_area,
                is_interview_prep=is_interview_prep,
                company_context=company_context,
                created_at=timezone.now(),
                updated_at=timezone.now(),
            )
            serializer = self.get_serializer(obj)
            return Response({
                'message': 'System design response generated successfully',
                'response': ai_response,
                'data': serializer.data
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': f'AI model error: {str(e)}'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    @action(detail=False, methods=['get'])
    def by_system_type(self, request):
        system_type = request.query_params.get('system_type')
        if not system_type:
            return Response(
                {'error': 'system_type parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        valid_choices = dict(SystemDesignAIResponse.SYSTEM_TYPE_CHOICES)
        if system_type not in valid_choices:
            return Response(
                {'error': f'Invalid system_type. Must be one of: {', '.join(valid_choices.keys())}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        filtered = self.get_queryset().filter(system_type=system_type)
        serializer = self.get_serializer(filtered, many=True)
        return Response({
            'count': len(filtered),
            'system_type': system_type,
            'results': serializer.data
        })

    @action(detail=False, methods=['get'])
    def by_topic(self, request):
        tag = request.query_params.get('tag')
        if not tag:
            return Response(
                {'error': 'Tag parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        filtered = [resp for resp in self.get_queryset() if tag in resp.get_topic_tags_list()]
        serializer = self.get_serializer(filtered, many=True)
        return Response({
            'count': len(filtered),
            'tag': tag,
            'results': serializer.data
        })

    @action(detail=True, methods=['post'], throttle_classes = [AIRegenerationThrottle])
    def regenerate(self, request, pk=None):
        """
        Regenerate the AI response for a given System Design response object.
        POST /api/system-design-ai-responses/<id>/regenerate/
        """
        instance = self.get_object()
        try:
            user_tasks = Task.objects.filter(user=request.user, category='system_design')
            if user_tasks.exists():
                tasks_summary = "\n".join([
                    f"- {task.title} | {'Completed' if task.completed else 'Incomplete'}"
                    f" | Due: {task.due_date if task.due_date else 'N/A'}"
                    f"\n  {task.description[:100]}{'...' if len(task.description) > 100 else ''}"
                    for task in user_tasks
                ])
                tasks_section = f"User's System Design Tasks:\n{tasks_summary}\n\n"
            else:
                tasks_section = "User has no System Design tasks.\n\n"

            prompt = (
                f"{tasks_section}"
                "You are a System Design Expert specializing in large-scale distributed systems with 15+ years of experience "
                "in designing systems for companies like Google, Amazon, and Netflix. Your expertise includes scalable architecture design, "
                "database design and selection (SQL/NoSQL), microservices vs monolith decisions, load balancing and caching strategies, "
                "message queues and event-driven architecture, performance optimization and bottleneck identification, "
                "fault tolerance and disaster recovery.\n\n"
                "When responding, you must:\n"
                "- Start with requirements gathering and constraints\n"
                "- Consider scalability from day one\n"
                "- Discuss trade-offs between different approaches\n"
                "- Include capacity estimation and bottleneck analysis\n"
                "- Address availability, consistency, and partition tolerance (CAP theorem)\n"
                "- Provide diagrams or architectural overviews when helpful\n"
                "- Consider both technical and business constraints\n\n"
                "FORMATTING REQUIREMENTS - Format your response using clean markdown with:\n"
                "- Use ## for main headings\n"
                "- Use **bold** for important concepts (NOT asterisks)\n"
                "- Use ``` for code examples and configuration\n"
                "- Use - for bullet points\n"
                "- Add proper paragraph spacing\n"
                "- Do NOT use asterisks (*) anywhere in your response\n"
                "- Include diagrams or visual aids where appropriate\n\n"
                "Structure your response with these sections:\n"
                "1. ## Requirements Analysis\n"
                "2. ## System Constraints & Scale Estimation\n"
                "3. ## High-Level Architecture\n"
                "4. ## Database Design\n"
                "5. ## API Design\n"
                "6. ## Scalability & Performance\n"
                "7. ## Reliability & Fault Tolerance\n"
                "8. ## Technology Stack & Trade-offs\n"
                "9. ## Monitoring & Observability\n\n"
                f"Question: {instance.question}"
            )
            model = genai.GenerativeModel(settings.GEMINI_MODEL_NAME)
            response = model.generate_content(prompt)
            ai_response = response.text
            ai_response = clean_ai_response(ai_response)

            # Update the instance
            instance.response = ai_response
            instance.updated_at = timezone.now()
            instance.save()

            return Response({
                'message': 'Response regenerated successfully',
                'response': ai_response
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': f'AI model error: {str(e)}'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

class JobSearchAIResponseViewSet(viewsets.ModelViewSet):
    """
    ViewSet for handling Job Search AI Responses with user scoping and custom actions.
    Provides CRUD operations plus custom actions for filtering and AI generation.
    """
    serializer_class = JobSearchAIResponseSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        return JobSearchAIResponse.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['post'], throttle_classes=[AIGenerationThrottle])
    def generate_response(self, request):
        question = request.data.get('question')
        topic_tags = request.data.get('topic_tags', '')
        category = request.data.get('category', 'other')
        experience_level = request.data.get('experience_level', '')
        target_role = request.data.get('target_role', '')
        interview_type = request.data.get('interview_type', '')
        company_size = request.data.get('company_size', '')
        is_urgent = request.data.get('is_urgent', False)

        if not question or len(question.strip()) < 10:
            return Response({'error': 'A valid job search question is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Fetch user's Job Search tasks
            user_tasks = Task.objects.filter(user=request.user, category='job_search')
            if user_tasks.exists():
                tasks_summary = "\n".join([
                    f"- {task.title} | {'Completed' if task.completed else 'Incomplete'}"
                    f" | Due: {task.due_date if task.due_date else 'N/A'}"
                    f"\n  {task.description[:100]}{'...' if len(task.description) > 100 else ''}"
                    for task in user_tasks
                ])
                tasks_section = f"User's Job Search Tasks:\n{tasks_summary}\n\n"
            else:
                tasks_section = "User has no Job Search tasks.\n\n"

            prompt = (
                f"{tasks_section}"
                "You are an experienced Job Search Guide and Career Coach with 12+ years of experience helping professionals "
                "at all levels land their dream jobs at top companies like FAANG, startups, and Fortune 500 companies. "
                "Your expertise includes resume optimization and ATS systems, interview preparation (technical and behavioral), "
                "salary negotiation strategies, career transition planning, industry trends and market analysis, "
                "networking and personal branding, and job search strategies across different experience levels.\n\n"
                "When responding, you must:\n"
                "- Provide actionable, specific advice\n"
                "- Consider current job market trends (2024-2025)\n"
                "- Tailor advice to experience level and target role\n"
                "- Include examples and templates when helpful\n"
                "- Address both technical and soft skill development\n"
                "- Consider industry-specific requirements\n"
                "- Provide step-by-step action plans\n\n"
                "FORMATTING REQUIREMENTS - Format your response using clean markdown with:\n"
                "- Use ## for main headings\n"
                "- Use **bold** for important concepts (NOT asterisks)\n"
                "- Use - for bullet points\n"
                "- Add proper paragraph spacing\n"
                "- Do NOT use asterisks (*) anywhere in your response\n"
                "- Include tips, resources, and best practices where appropriate\n\n"
                "Structure your response with these sections:\n"
                "1. ## Situation Analysis\n"
                "2. ## Strategic Approach\n"
                "3. ## Action Plan\n"
                "4. ## Key Resources & Tools\n"
                "5. ## Timeline & Milestones\n"
                "6. ## Common Pitfalls to Avoid\n"
                "7. ## Success Metrics\n\n"
                f"Question: {question}"
            )
            model = genai.GenerativeModel(settings.GEMINI_MODEL_NAME)
            response = model.generate_content(prompt)
            ai_response = response.text
            ai_response = clean_ai_response(ai_response)  # Clean the response

            obj = JobSearchAIResponse.objects.create(
                user=request.user,
                question=question,
                response=ai_response,
                topic_tags=topic_tags,
                category=category,
                experience_level=experience_level,
                target_role=target_role,
                interview_type=interview_type,
                company_size=company_size,
                is_urgent=is_urgent,
                created_at=timezone.now(),
                updated_at=timezone.now(),
            )
            serializer = self.get_serializer(obj)
            return Response({
                'message': 'Job search response generated successfully',
                'response': ai_response,
                'data': serializer.data
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': f'AI model error: {str(e)}'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    @action(detail=False, methods=['get'])
    def by_category(self, request):
        category = request.query_params.get('category')
        if not category:
            return Response(
                {'error': 'category parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        valid_choices = dict(JobSearchAIResponse.CATEGORY_CHOICES)
        if category not in valid_choices:
            return Response(
                {'error': f'Invalid category. Must be one of: {', '.join(valid_choices.keys())}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        filtered = self.get_queryset().filter(category=category)
        serializer = self.get_serializer(filtered, many=True)
        return Response({
            'count': len(filtered),
            'category': category,
            'results': serializer.data
        })

    @action(detail=False, methods=['get'])
    def by_topic(self, request):
        tag = request.query_params.get('tag')
        if not tag:
            return Response(
                {'error': 'Tag parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        filtered = [resp for resp in self.get_queryset() if tag in resp.get_topic_tags_list()]
        serializer = self.get_serializer(filtered, many=True)
        return Response({
            'count': len(filtered),
            'tag': tag,
            'results': serializer.data
        })

    @action(detail=True, methods=['post'], throttle_classes = [AIRegenerationThrottle])
    def regenerate(self, request, pk=None):
        """
        Regenerate the AI response for a given Job Search response object.
        POST /api/job-search-ai-responses/<id>/regenerate/
        """
        instance = self.get_object()
        try:
            user_tasks = Task.objects.filter(user=request.user, category='job_search')
            if user_tasks.exists():
                tasks_summary = "\n".join([
                    f"- {task.title} | {'Completed' if task.completed else 'Incomplete'}"
                    f" | Due: {task.due_date if task.due_date else 'N/A'}"
                    f"\n  {task.description[:100]}{'...' if len(task.description) > 100 else ''}"
                    for task in user_tasks
                ])
                tasks_section = f"User's Job Search Tasks:\n{tasks_summary}\n\n"
            else:
                tasks_section = "User has no Job Search tasks.\n\n"

            prompt = (
                f"{tasks_section}"
                "You are an experienced Job Search Guide and Career Coach with 12+ years of experience helping professionals "
                "at all levels land their dream jobs at top companies like FAANG, startups, and Fortune 500 companies. "
                "Your expertise includes resume optimization and ATS systems, interview preparation (technical and behavioral), "
                "salary negotiation strategies, career transition planning, industry trends and market analysis, "
                "networking and personal branding, and job search strategies across different experience levels.\n\n"
                "When responding, you must:\n"
                "- Provide actionable, specific advice\n"
                "- Consider current job market trends (2024-2025)\n"
                "- Tailor advice to experience level and target role\n"
                "- Include examples and templates when helpful\n"
                "- Address both technical and soft skill development\n"
                "- Consider industry-specific requirements\n"
                "- Provide step-by-step action plans\n\n"
                "FORMATTING REQUIREMENTS - Format your response using clean markdown with:\n"
                "- Use ## for main headings\n"
                "- Use **bold** for important concepts (NOT asterisks)\n"
                "- Use - for bullet points\n"
                "- Add proper paragraph spacing\n"
                "- Do NOT use asterisks (*) anywhere in your response\n"
                "- Include tips, resources, and best practices where appropriate\n\n"
                "Structure your response with these sections:\n"
                "1. ## Situation Analysis\n"
                "2. ## Strategic Approach\n"
                "3. ## Action Plan\n"
                "4. ## Key Resources & Tools\n"
                "5. ## Timeline & Milestones\n"
                "6. ## Common Pitfalls to Avoid\n"
                "7. ## Success Metrics\n\n"
                f"Question: {instance.question}"
            )
            model = genai.GenerativeModel(settings.GEMINI_MODEL_NAME)
            response = model.generate_content(prompt)
            ai_response = response.text
            ai_response = clean_ai_response(ai_response)

            # Update the instance
            instance.response = ai_response
            instance.updated_at = timezone.now()
            instance.save()

            return Response({
                'message': 'Response regenerated successfully',
                'response': ai_response
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': f'AI model error: {str(e)}'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

def clean_ai_response(response_text):
    """
    Clean and format AI response text
    """
    import re
    
    # Remove excessive asterisks and convert to proper markdown
    response_text = re.sub(r'\*{3,}', '**', response_text)  # Convert 3+ asterisks to bold
    response_text = re.sub(r'\*{2,}', '**', response_text)  # Convert 2+ asterisks to bold
    
    # Convert single asterisks to bold (but be careful with code blocks)
    # First, protect code blocks
    code_blocks = re.findall(r'```.*?```', response_text, re.DOTALL)
    for i, block in enumerate(code_blocks):
        response_text = response_text.replace(block, f'__CODE_BLOCK_{i}__')
    
    # Now convert single asterisks to bold
    response_text = re.sub(r'\*([^*\n]+)\*', r'**\1**', response_text)
    
    # Restore code blocks
    for i, block in enumerate(code_blocks):
        response_text = response_text.replace(f'__CODE_BLOCK_{i}__', block)
    
    # Clean up spacing
    response_text = re.sub(r'\n{3,}', '\n\n', response_text)  # Remove excessive line breaks
    response_text = re.sub(r' +', ' ', response_text)  # Remove multiple spaces
    
    # Ensure proper markdown formatting
    response_text = re.sub(r'^\*\*([^*]+)\*\*$', r'## \1', response_text, flags=re.MULTILINE)  # Convert bold lines to headers
    
    # Clean up bullet points
    response_text = re.sub(r'^\*\*   \*\*', '- ', response_text, flags=re.MULTILINE)
    response_text = re.sub(r'^\*\*   ', '- ', response_text, flags=re.MULTILINE)
    
    # Ensure code blocks are properly formatted
    response_text = re.sub(r'```(\w+)?\n', r'```\1\n', response_text)
    
    return response_text.strip()
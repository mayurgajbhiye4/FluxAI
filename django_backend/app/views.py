from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, viewsets, permissions 
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import api_view, permission_classes, action
from django.shortcuts import render
from django.contrib.auth import authenticate, login, logout
from .models import CustomUser,Task, Goal
from .serializers import UserSerializer, LoginSerializer, GoalSerializer, TaskSerializer
from django.views.decorators.http import require_GET
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.conf import settings
from django.utils import timezone

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

    @action(detail=False, methods=['post'])
    def update_streak(self, request):
        """
        Endpoint to update weekly streaks
        This would typically be called by a scheduled job
        """
        user = request.user
        today = timezone.now().date()
        
        # Get all goals for the user
        goals = Goal.objects.filter(user=user)
        
        for goal in goals:
            # Logic for updating streak based on task completion
            # This is a simplified version - real implementation would check 
            # if user completed daily target for the category
            goal.weekly_streak = min(goal.weekly_streak + 1, 7)
            goal.save()
            
        return Response({'status': 'streaks updated'}, status=status.HTTP_200_OK)
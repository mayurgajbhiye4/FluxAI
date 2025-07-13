from django.urls import path, include
from .views import home, csrf_token, UserDetailsView, LoginView, SignupView, LogoutView

from rest_framework.routers import DefaultRouter
from app.views import TaskViewSet, GoalViewSet,DSAAIResponseViewSet, SoftwareDevAIResponseViewSet, SystemDesignAIResponseViewSet, JobSearchAIResponseViewSet

router = DefaultRouter()
router.register(r'tasks', TaskViewSet, basename="task")
router.register(r'goals', GoalViewSet, basename="goal")

router.register(r'dsa-ai-responses', DSAAIResponseViewSet, basename='dsa-ai-response')
router.register(r'software-dev-ai-responses', SoftwareDevAIResponseViewSet, basename='software-dev-ai-response')
router.register(r'system-design-ai-responses', SystemDesignAIResponseViewSet, basename='system-design-ai-response')
router.register(r'job-search-ai-responses', JobSearchAIResponseViewSet, basename='job-search-ai-response')

urlpatterns = [
    path('api/', include(router.urls)),
    path('', home, name = 'home'),

    path('api/me/', UserDetailsView.as_view(), name='user-details'),

    path('api/csrf_token/', csrf_token, name='csrf_token'),

    path('api/login/', LoginView.as_view(), name='login'),
    path('api/signup/', SignupView.as_view(), name='signup'),
    path('api/logout/', LogoutView.as_view(), name='logout'),
]

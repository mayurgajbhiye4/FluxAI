from django.urls import path, re_path
from django.views.generic import TemplateView
from .views import home, csrf_token, UserDetailsView, LoginView, SignupView, LogoutView

urlpatterns = [
    path('', home, name='home'),

    path('api/me/', UserDetailsView.as_view(), name='user-details'),

    path('api/csrf_token/', csrf_token, name='csrf_token'),

    path('api/login/', LoginView.as_view(), name='login'),
    path('api/signup/', SignupView.as_view(), name='signup'),
    path('api/logout/', LogoutView.as_view(), name='logout'),

    re_path(r'^(?:.*)/?$', TemplateView.as_view(template_name='index.html')),
]
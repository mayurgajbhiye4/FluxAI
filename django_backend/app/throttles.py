from rest_framework.throttling import UserRateThrottle, AnonRateThrottle, ScopedRateThrottle
from rest_framework.throttling import SimpleRateThrottle
from django.core.cache import cache
from django.contrib.auth.models import AnonymousUser

class AIGenerationThrottle(SimpleRateThrottle):
    """
    Throttle for AI generation endpoints - more restrictive
    """
    scope = 'ai_generation'
    
    def get_cache_key(self, request, view):
        if request.user.is_authenticated:
            ident = request.user.pk
        else:
            ident = self.get_ident(request)
        return f"ai_generation_{ident}"

class AIRegenerationThrottle(SimpleRateThrottle):
    """
    Throttle for AI regeneration endpoints - very restrictive
    """
    scope = 'ai_regeneration'
    
    def get_cache_key(self, request, view):
        if request.user.is_authenticated:
            ident = request.user.pk
        else:
            ident = self.get_ident(request)
        return f"ai_regeneration_{ident}"

class BurstRateThrottle(SimpleRateThrottle):
    """
    Burst rate throttle for high-frequency endpoints
    """
    scope = 'burst'
    
    def get_cache_key(self, request, view):
        if request.user.is_authenticated:
            ident = request.user.pk
        else:
            ident = self.get_ident(request)
        return f"burst_{ident}"

class SustainedRateThrottle(SimpleRateThrottle):
    """
    Sustained rate throttle for long-term usage
    """
    scope = 'sustained'
    
    def get_cache_key(self, request, view):
        if request.user.is_authenticated:
            ident = request.user.pk
        else:
            ident = self.get_ident(request)
        return f"sustained_{ident}"

class UserBasedThrottle(SimpleRateThrottle):
    """
    Custom throttle that applies different rates based on user type
    """
    scope = 'user_based'
    
    def get_cache_key(self, request, view):
        if request.user.is_authenticated:
            ident = request.user.pk
        else:
            ident = self.get_ident(request)
        return f"user_based_{ident}"
    
    def get_rate(self):
        """
        Override to provide different rates based on user
        """
        if hasattr(self, 'request') and self.request.user.is_authenticated:
            # You can add logic here to check user roles, subscription status, etc.
            # For now, we'll use the default rate
            return self.rate
        return self.rate 
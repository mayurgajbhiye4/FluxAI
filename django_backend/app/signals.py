from django.db.models.signals import post_save
from django.dispatch import receiver
from django.conf import settings
from .models import Goal, Category  

@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_default_goals(sender, instance, created, **kwargs):
    if created:
        default_goals = [
            {
                'category': Category.DSA,  
                'daily_target': 3, 
            },
            {
                'category': Category.DEVELOPMENT,
                'daily_target': 3,  
            },
            {
                'category': Category.SYSTEM_DESIGN,
                'daily_target': 3, 
            },
            {
                'category': Category.JOB_SEARCH,
                'daily_target': 3, 
            },
        ]
        
        for goal_data in default_goals:
            Goal.objects.create(
                user=instance,
                **goal_data
            )
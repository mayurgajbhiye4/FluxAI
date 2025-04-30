from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.utils import timezone

class CustomUserManager(BaseUserManager):
    def create_user(self, email, username, password=None, **extra_fields):
        if not email:
            raise ValueError(_('The Email must be set'))
        email = self.normalize_email(email)
        user = self.model(email=email, username=username, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, username, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, username, password, **extra_fields)
    
    
class CustomUser(AbstractUser):
    # Remove the default username field declaration
    email = models.EmailField(_('email address'), unique=True)
    username = models.CharField(_('username'), max_length=150, unique=True)
    
    # Required for proper authentication flow
    USERNAME_FIELD = 'email'  # Makes email the login identifier
    REQUIRED_FIELDS = ['username']  # Fields required for createsuperuser

    objects = CustomUserManager()  # Use custom manager

    def __str__(self):
        return self.email

    class Meta:
        verbose_name = _('user')
        verbose_name_plural = _('users')


class Profile(models.Model):
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE)
 

class Category(models.TextChoices):
    DSA = 'dsa', _('Data Structures & Algorithms')
    DEVELOPMENT = 'development', _('Development')
    SYSTEM_DESIGN = 'system_design', _('System Design')
    JOB_SEARCH = 'job_search', _('Job Search')


class Task(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='tasks')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=20, choices=Category.choices)
    completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    due_date = models.DateField(null=True, blank=True)
    priority = models.PositiveSmallIntegerField(default=1)  # 1-5 scale
    tags = models.JSONField(default=list, blank=True)
    progress = models.PositiveSmallIntegerField(default=0)  # 0-100 percentage

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['category']),
            models.Index(fields=['completed']),
        ]

    def __str__(self):
        return f"{self.title} ({self.get_category_display()})"
    

class Goal(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='goals')
    category = models.CharField(max_length=20, choices=Category.choices)
    daily_target = models.PositiveIntegerField(default=3)
    weekly_streak = models.PositiveIntegerField(default=0)
    current_week_days_completed = models.JSONField(default=list)  # Stores days of week (0-6) completed this week
    last_completed_date = models.DateField(null=True, blank=True)
    streak_started_at = models.DateField(null=True, blank=True) 

    class Meta:
        unique_together = ('user', 'category')
        ordering = ['category']

    def __str__(self):
        return f"{self.get_category_display()} Goals for {self.user.username}"
    
    def save(self, *args, **kwargs):
        # Update last_updated field
        self.last_updated = timezone.now().date()
        super().save(*args, **kwargs)
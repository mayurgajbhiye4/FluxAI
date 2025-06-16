from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.utils import timezone
from datetime import timedelta

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

    daily_progress = models.PositiveIntegerField(default=0)  # Current day's completed tasks
    last_daily_reset = models.DateField(null=True, blank=True)  # Track last reset date

    weekly_streak = models.PositiveIntegerField(default=0)
    current_week_days_completed = models.JSONField(default=list)  # Stores days of week (0-6) completed this week
    current_week_start = models.DateField(null=True, blank=True) # Track which week we're in
    last_completed_date = models.DateField(null=True, blank=True)
    streak_started_at = models.DateField(null=True, blank=True) 

    class Meta:
        unique_together = ('user', 'category')
        ordering = ['category']

    def __str__(self):
        return f"{self.get_category_display()} Goals for {self.user.username}"
    
    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)


    def get_monday_of_week(self, date_obj):
        """Get the Monday of the week for a given date."""
        days_since_monday = date_obj.weekday()  # Monday = 0, Sunday = 6
        return date_obj - timedelta(days=days_since_monday)
    

    def reset_daily_progress_if_new_day(self):
        """Reset daily progress if it's a new day."""
        today = timezone.now().date()
        
        if self.last_daily_reset != today:
            self.daily_progress = 0
            self.last_daily_reset = today
            self.save()


    def is_daily_goal_completed(self):
        """Check if today's daily goal is completed."""
        self.reset_daily_progress_if_new_day()  # Ensure we have current day's data
        return self.daily_progress >= self.daily_target 
    

    def add_daily_progress(self, amount=1):
        """Add progress to today's daily goal."""
        self.check_and_handle_new_week()
        self.reset_daily_progress_if_new_day()
        
        old_progress = self.daily_progress
        self.daily_progress = min(self.daily_progress + amount, self.daily_target)
        
        # If daily goal is newly completed, mark the day as completed for weekly tracking
        if old_progress < self.daily_target and self.daily_progress >= self.daily_target:
            self.add_completed_day()
        
        self.save()

    def is_new_week(self):
        """Check if we've entered a new week since last tracking."""
        if not self.current_week_start:
            return True
        
        today = timezone.now().date()
        current_monday = self.get_monday_of_week(today)
        
        return current_monday > self.current_week_start 
    

    def start_new_week(self):
        """Initialize tracking for a new week."""
        today = timezone.now().date()
        self.current_week_start = self.get_monday_of_week(today)
        self.current_week_days_completed = []
        # Reset weekly streak to 0 for the new week
        self.weekly_streak = 0
        self.streak_started_at = None


    def check_and_handle_new_week(self):
        """Check if it's a new week and handle the transition."""
        if self.is_new_week():
            # Simply start the new week - no need to check previous week
            self.start_new_week()
            return True
        return False


    def is_week_completed(self):
        """Check if the current week meets completion criteria."""
        if not self.current_week_days_completed:
            return False
        
        # Example: Consider week completed if at least 5 days were completed
        # You can customize this logic based on your requirements
        return len(self.current_week_days_completed) >= 5 
    

    def update_weekly_streak(self):
        """Update weekly streak based on current week completion."""
        if self.is_week_completed():
            if self.weekly_streak == 0:
                # First time completing this week   
                self.weekly_streak = 1
                self.streak_started_at = self.current_week_start
            elif self.streak_started_at and self.current_week_start:
                # Check if this is a consecutive week
                last_week_start = self.streak_started_at + timedelta(days=7)
                if self.current_week_start == last_week_start:
                    # Consecutive week completed
                    self.weekly_streak += 1
                else:
                    # Streak broken, start over
                    self.weekly_streak = 1
                    self.streak_started_at = self.current_week_start
        else:
            # Week not completed, reset streak
            self.weekly_streak = 0
            self.streak_started_at = None
    

    def add_completed_day(self, date_obj=None):
        """Add a completed day to the current week."""
        if date_obj is None:
            date_obj = timezone.now().date() 
        
        # Check for new week first
        self.check_and_handle_new_week()
        
        # Get day of week (0 = Monday, 6 = Sunday)
        day_of_week = date_obj.weekday()
        
        # Add if not already completed
        if day_of_week not in self.current_week_days_completed:
            self.current_week_days_completed.append(day_of_week)
            self.current_week_days_completed.sort()  # Keep sorted for consistency
            self.last_completed_date = date_obj

            self.update_weekly_streak()
            self.save()



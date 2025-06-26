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


class DSAAIResponse(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='dsa_ai_responses')
    question = models.TextField(help_text="The DSA question asked by the user")
    response = models.TextField(help_text="AI generated response for the DSA question")
    
    # Optional: Add tags/topics for better categorization
    topic_tags = models.CharField(
        max_length=255, 
        blank=True, 
        help_text="Comma-separated tags like 'arrays,sorting,binary-search'"
    )
    
    # Difficulty level if applicable
    DIFFICULTY_CHOICES = [
        ('easy', 'Easy'),
        ('medium', 'Medium'),
        ('hard', 'Hard'),
        ('unknown', 'Unknown'),
    ]
    difficulty = models.CharField(
        max_length=10, 
        choices=DIFFICULTY_CHOICES, 
        default='unknown',
        help_text="Difficulty level of the DSA problem discussed"
    )
    
    # Problem source (LeetCode, HackerRank, etc.)
    problem_source = models.CharField(
        max_length=100, 
        blank=True,
        help_text="Source platform like LeetCode, HackerRank, etc."
    )
    
    # Problem number/identifier
    problem_id = models.CharField(
        max_length=50, 
        blank=True,
        help_text="Problem number or identifier from the source"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # User interaction tracking
    is_helpful = models.BooleanField(
        null=True, 
        blank=True,
        help_text="User feedback on response helpfulness"
    )
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'DSA AI Response'
        verbose_name_plural = 'DSA AI Responses'
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['difficulty']),
            models.Index(fields=['problem_source']),
        ]

    def __str__(self):
        return f"DSA Q&A: {self.question[:50]}... - {self.user.username}"
    
    def get_topic_tags_list(self):
        """Return topic tags as a list"""
        if self.topic_tags:
            return [tag.strip() for tag in self.topic_tags.split(',') if tag.strip()]
        return []
    
    def set_topic_tags_from_list(self, tags_list):
        """Set topic tags from a list"""
        self.topic_tags = ','.join(tags_list)


class SoftwareDevAIResponse(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='software_dev_ai_responses')
    question = models.TextField(help_text="The software development question asked by the user")
    response = models.TextField(help_text="AI generated response for the software development question")
    
    # Optional: Add tags/topics for better categorization
    topic_tags = models.CharField(
        max_length=255, 
        blank=True, 
        help_text="Comma-separated tags like 'react,python,api,database,debugging'"
    )
    
    # Technology stack
    TECH_STACK_CHOICES = [
        ('frontend', 'Frontend'),
        ('backend', 'Backend'),
        ('fullstack', 'Full Stack'),
        ('mobile', 'Mobile'),
        ('devops', 'DevOps'),
        ('database', 'Database'),
        ('other', 'Other'),
    ]
    tech_stack = models.CharField(
        max_length=20, 
        choices=TECH_STACK_CHOICES, 
        default='other',
        help_text="Technology stack category"
    )
    
    # Programming language
    programming_language = models.CharField(
        max_length=50, 
        blank=True,
        help_text="Primary programming language discussed (e.g., Python, JavaScript, Java)"
    )
    
    # Framework/Library
    framework = models.CharField(
        max_length=100, 
        blank=True,
        help_text="Framework or library discussed (e.g., React, Django, Express)"
    )
    
    # Question type
    QUESTION_TYPE_CHOICES = [
        ('bug_fix', 'Bug Fix'),
        ('feature', 'Feature Implementation'),
        ('optimization', 'Performance Optimization'),
        ('best_practice', 'Best Practices'),
        ('architecture', 'Architecture Design'),
        ('learning', 'Learning/Tutorial'),
        ('other', 'Other'),
    ]
    question_type = models.CharField(
        max_length=20,
        choices=QUESTION_TYPE_CHOICES,
        default='other',
        help_text="Type of development question"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # User interaction tracking
    is_helpful = models.BooleanField(
        null=True, 
        blank=True,
        help_text="User feedback on response helpfulness"
    )
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Software Development AI Response'
        verbose_name_plural = 'Software Development AI Responses'
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['tech_stack']),
            models.Index(fields=['programming_language']),
            models.Index(fields=['question_type']),
        ]

    def __str__(self):
        return f"Dev Q&A: {self.question[:50]}... - {self.user.username}"
    
    def get_topic_tags_list(self):
        """Return topic tags as a list"""
        if self.topic_tags:
            return [tag.strip() for tag in self.topic_tags.split(',') if tag.strip()]
        return []
    
    def set_topic_tags_from_list(self, tags_list):
        """Set topic tags from a list"""
        self.topic_tags = ','.join(tags_list)


class SystemDesignAIResponse(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='system_design_ai_responses')
    question = models.TextField(help_text="The system design question asked by the user")
    response = models.TextField(help_text="AI generated response for the system design question")
    
    # Optional: Add tags/topics for better categorization
    topic_tags = models.CharField(
        max_length=255, 
        blank=True, 
        help_text="Comma-separated tags like 'scalability,database,microservices,caching'"
    )
    
    # System scale/complexity
    SCALE_CHOICES = [
        ('small', 'Small Scale (< 1K users)'),
        ('medium', 'Medium Scale (1K - 100K users)'),
        ('large', 'Large Scale (100K - 1M users)'),
        ('massive', 'Massive Scale (> 1M users)'),
        ('unknown', 'Unknown Scale'),
    ]
    system_scale = models.CharField(
        max_length=10, 
        choices=SCALE_CHOICES, 
        default='unknown',
        help_text="Expected scale of the system being designed"
    )
    
    # System type/domain
    SYSTEM_TYPE_CHOICES = [
        ('web_app', 'Web Application'),
        ('mobile_app', 'Mobile Application'),
        ('api', 'API/Service'),
        ('data_pipeline', 'Data Pipeline'),
        ('messaging', 'Messaging System'),
        ('social_media', 'Social Media Platform'),
        ('e_commerce', 'E-commerce Platform'),
        ('streaming', 'Streaming Service'),
        ('gaming', 'Gaming Platform'),
        ('iot', 'IoT System'),
        ('other', 'Other'),
    ]
    system_type = models.CharField(
        max_length=20, 
        choices=SYSTEM_TYPE_CHOICES, 
        default='other',
        help_text="Type of system being designed"
    )
    
    # Design focus area
    FOCUS_AREA_CHOICES = [
        ('architecture', 'High-Level Architecture'),
        ('database', 'Database Design'),
        ('scalability', 'Scalability Solutions'),
        ('performance', 'Performance Optimization'),
        ('availability', 'High Availability'),
        ('consistency', 'Data Consistency'),
        ('security', 'Security Design'),
        ('monitoring', 'Monitoring & Observability'),
        ('deployment', 'Deployment Strategy'),
        ('other', 'Other'),
    ]
    focus_area = models.CharField(
        max_length=20,
        choices=FOCUS_AREA_CHOICES,
        default='architecture',
        help_text="Primary focus area of the system design question"
    )
    
    # Interview/Practice context
    is_interview_prep = models.BooleanField(
        default=False,
        help_text="Whether this question is for interview preparation"
    )
    
    # Company context (optional)
    company_context = models.CharField(
        max_length=100, 
        blank=True,
        help_text="Company or context for the system design (e.g., 'Design Twitter', 'Design Netflix')"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # User interaction tracking
    is_helpful = models.BooleanField(
        null=True, 
        blank=True,
        help_text="User feedback on response helpfulness"
    )
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'System Design AI Response'
        verbose_name_plural = 'System Design AI Responses'
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['system_scale']),
            models.Index(fields=['system_type']),
            models.Index(fields=['focus_area']),
            models.Index(fields=['is_interview_prep']),
        ]

    def __str__(self):
        return f"System Design Q&A: {self.question[:50]}... - {self.user.username}"
    
    def get_topic_tags_list(self):
        """Return topic tags as a list"""
        if self.topic_tags:
            return [tag.strip() for tag in self.topic_tags.split(',') if tag.strip()]
        return []
    
    def set_topic_tags_from_list(self, tags_list):
        """Set topic tags from a list"""
        self.topic_tags = ','.join(tags_list)


class JobSearchAIResponse(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='job_search_ai_responses')
    question = models.TextField(help_text="The job search question asked by the user")
    response = models.TextField(help_text="AI generated response for the job search question")
    
    # Optional: Add tags/topics for better categorization
    topic_tags = models.CharField(
        max_length=255, 
        blank=True, 
        help_text="Comma-separated tags like 'resume,interview,salary,networking,cover-letter'"
    )
    
    # Job search category
    CATEGORY_CHOICES = [
        ('resume', 'Resume/CV'),
        ('cover_letter', 'Cover Letter'),
        ('interview_prep', 'Interview Preparation'),
        ('job_search', 'Job Search Strategy'),
        ('salary_negotiation', 'Salary Negotiation'),
        ('networking', 'Networking'),
        ('career_advice', 'Career Advice'),
        ('portfolio', 'Portfolio/Projects'),
        ('linkedin', 'LinkedIn Profile'),
        ('application', 'Job Application'),
        ('other', 'Other'),
    ]
    category = models.CharField(
        max_length=20, 
        choices=CATEGORY_CHOICES, 
        default='other',
        help_text="Category of job search question"
    )
    
    # Experience level context
    EXPERIENCE_LEVEL_CHOICES = [
        ('entry', 'Entry Level (0-2 years)'),
        ('mid', 'Mid Level (2-5 years)'),
        ('senior', 'Senior Level (5+ years)'),
        ('lead', 'Lead/Manager Level'),
        ('executive', 'Executive Level'),
        ('career_change', 'Career Change'),
        ('student', 'Student/Graduate'),
    ]
    experience_level = models.CharField(
        max_length=15, 
        choices=EXPERIENCE_LEVEL_CHOICES, 
        blank=True,
        help_text="Experience level context for the question"
    )
    
    # Target role/field
    target_role = models.CharField(
        max_length=100, 
        blank=True,
        help_text="Target job role or field (e.g., Software Engineer, Product Manager, Data Scientist)"
    )
    
    # Interview type (if applicable)
    INTERVIEW_TYPE_CHOICES = [
        ('behavioral', 'Behavioral Interview'),
        ('technical', 'Technical Interview'),
        ('system_design', 'System Design Interview'),
        ('coding', 'Coding Interview'),
        ('case_study', 'Case Study'),
        ('phone_screen', 'Phone Screening'),
        ('final_round', 'Final Round'),
        ('other', 'Other'),
    ]
    interview_type = models.CharField(
        max_length=15,
        choices=INTERVIEW_TYPE_CHOICES,
        blank=True,
        help_text="Type of interview (if question is interview-related)"
    )
    
    # Company size context
    COMPANY_SIZE_CHOICES = [
        ('startup', 'Startup (< 50 employees)'),
        ('small', 'Small Company (50-200 employees)'),
        ('medium', 'Medium Company (200-1000 employees)'),
        ('large', 'Large Company (1000+ employees)'),
        ('big_tech', 'Big Tech (FAANG/MAANG)'),
        ('any', 'Any Size'),
    ]
    company_size = models.CharField(
        max_length=10,
        choices=COMPANY_SIZE_CHOICES,
        blank=True,
        help_text="Target company size context"
    )
    
    # Priority/Urgency
    is_urgent = models.BooleanField(
        default=False,
        help_text="Whether this is an urgent job search question (e.g., interview tomorrow)"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # User interaction tracking
    is_helpful = models.BooleanField(
        null=True, 
        blank=True,
        help_text="User feedback on response helpfulness"
    )
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Job Search AI Response'
        verbose_name_plural = 'Job Search AI Responses'
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['category']),
            models.Index(fields=['experience_level']),
            models.Index(fields=['interview_type']),
            models.Index(fields=['is_urgent']),
        ]

    def __str__(self):
        return f"Job Search Q&A: {self.question[:50]}... - {self.user.username}"
    
    def get_topic_tags_list(self):
        """Return topic tags as a list"""
        if self.topic_tags:
            return [tag.strip() for tag in self.topic_tags.split(',') if tag.strip()]
        return []
    
    def set_topic_tags_from_list(self, tags_list):
        """Set topic tags from a list"""
        self.topic_tags = ','.join(tags_list)

from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import *

class UserSerializer(serializers.ModelSerializer):
    confirm_password = serializers.CharField(write_only=True)
    
    class Meta:
        model = CustomUser
        fields = ('email', 'username', 'password', 'confirm_password')
        extra_kwargs = {
            'password': {'write_only': True},
        }

    def validate(self, data):
        if data['password'] != data.pop('confirm_password'):
            raise serializers.ValidationError("Passwords do not match")
        
        validate_password(data['password'])
        return data

    def create(self, validated_data):
        validated_data.pop('confirm_password', None)
        return super().create(validated_data)
    
    
class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(required=True, write_only=True)


class TaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = '__all__'
        read_only_fields = ('user', 'created_at', 'updated_at')

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)
    
    
class GoalSerializer(serializers.ModelSerializer):
    days_completed_this_week = serializers.SerializerMethodField()
    is_week_completed = serializers.SerializerMethodField()

    # Daily tracking fields
    daily_progress = serializers.IntegerField(read_only=True)
    last_daily_reset = serializers.DateField(read_only=True)
    is_daily_goal_completed = serializers.SerializerMethodField()

    class Meta:
        model = Goal
        fields = [
            'id', 
            'category', 
            'daily_target', 
            'daily_progress',
            'last_daily_reset',
            'is_daily_goal_completed',
            'weekly_streak',
            'current_week_days_completed',
            'current_week_start',
            'last_completed_date',
            'streak_started_at',
            'days_completed_this_week',
            'is_week_completed'
        ]   
        read_only_fields = [
            'id', 
            'user', 
            'daily_progress',
            'last_daily_reset',
            'weekly_streak',
            'current_week_days_completed',
            'current_week_start', 
            'last_completed_date', 
            'streak_started_at'
        ]

    def get_days_completed_this_week(self, obj):
        """Return the number of days completed this week."""
        return len(obj.current_week_days_completed)
    
    def get_is_week_completed(self, obj):
        """Return whether the week completion criteria is met."""
        return obj.is_week_completed()
    
    def get_is_daily_goal_completed(self, obj):
        """Check if today's daily goal is completed."""
        return obj.is_daily_goal_completed()
    
    def validate_category(self, value):
        user = self.context['request'].user
        if self.instance is None:
            if Goal.objects.filter(user=user, category=value).exists():
                raise serializers.ValidationError("goal with this category already exists.")
        return value    
    
    def to_representation(self, instance):
        """Ensure daily progress is reset if needed before serialization."""
        instance.reset_daily_progress_if_new_day()
        return super().to_representation(instance)
    

class DSAAIResponseSerializer(serializers.ModelSerializer):
    topic_tags = serializers.ListField(
        child=serializers.CharField(),
        source='get_topic_tags_list',
        write_only=False,
        required=False
    )
    user = serializers.StringRelatedField(read_only=True)  # or use PrimaryKeyRelatedField for user id

    class Meta:
        model = DSAAIResponse
        fields = [
            'id',
            'user',
            'question',
            'response',
            'topic_tags',
            'difficulty',
            'problem_source',
            'problem_id',
            'created_at',
            'updated_at',
            'is_helpful',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'user']

    def to_representation(self, instance):
        """Convert topic_tags to a list for output."""
        ret = super().to_representation(instance)
        ret['topic_tags'] = instance.get_topic_tags_list()
        return ret

    def to_internal_value(self, data):
        """Convert topic_tags from list to comma-separated string for input."""
        tags = data.get('topic_tags')
        if tags is not None and isinstance(tags, list):
            data = data.copy()
            data['topic_tags'] = ','.join(tags)
        return super().to_internal_value(data)
    

class SoftwareDevAIResponseSerializer(serializers.ModelSerializer):
    topic_tags = serializers.ListField(
        child=serializers.CharField(),
        source='get_topic_tags_list',
        write_only=False,
        required=False
    )
    user = serializers.StringRelatedField(read_only=True)  # or use PrimaryKeyRelatedField for user id

    class Meta:
        model = SoftwareDevAIResponse
        fields = [
            'id',
            'user',
            'question',
            'response',
            'topic_tags',
            'tech_stack',
            'programming_language',
            'framework',
            'question_type',
            'created_at',
            'updated_at',
            'is_helpful',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'user']

    def to_representation(self, instance):
        """Convert topic_tags to a list for output."""
        ret = super().to_representation(instance)
        ret['topic_tags'] = instance.get_topic_tags_list()
        return ret

    def to_internal_value(self, data):
        """Convert topic_tags from list to comma-separated string for input."""
        tags = data.get('topic_tags')
        if tags is not None and isinstance(tags, list):
            data = data.copy()
            data['topic_tags'] = ','.join(tags)
        return super().to_internal_value(data)
    

class SystemDesignAIResponseSerializer(serializers.ModelSerializer):
    topic_tags = serializers.ListField(
        child=serializers.CharField(),
        source='get_topic_tags_list',
        write_only=False,
        required=False
    )
    user = serializers.StringRelatedField(read_only=True)  # Shows username or __str__ of user

    class Meta:
        model = SystemDesignAIResponse
        fields = [
            'id',
            'user',
            'question',
            'response',
            'topic_tags',
            'system_scale',
            'system_type',
            'focus_area',
            'is_interview_prep',
            'company_context',
            'created_at',
            'updated_at',
            'is_helpful',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'user']

    def to_representation(self, instance):
        """Convert topic_tags to a list for output."""
        ret = super().to_representation(instance)
        ret['topic_tags'] = instance.get_topic_tags_list()
        return ret

    def to_internal_value(self, data):
        """Convert topic_tags from list to comma-separated string for input."""
        tags = data.get('topic_tags')
        if tags is not None and isinstance(tags, list):
            data = data.copy()
            data['topic_tags'] = ','.join(tags)
        return super().to_internal_value(data)
    

class JobSearchAIResponseSerializer(serializers.ModelSerializer):
    topic_tags = serializers.ListField(
        child=serializers.CharField(),
        source='get_topic_tags_list',
        write_only=False,
        required=False
    )
    user = serializers.StringRelatedField(read_only=True)  # Shows username or __str__ of user

    class Meta:
        model = JobSearchAIResponse
        fields = [
            'id',
            'user',
            'question',
            'response',
            'topic_tags',
            'category',
            'experience_level',
            'target_role',
            'interview_type',
            'company_size',
            'is_urgent',
            'created_at',
            'updated_at',
            'is_helpful',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'user']

    def to_representation(self, instance):
        """Convert topic_tags to a list for output."""
        ret = super().to_representation(instance)
        ret['topic_tags'] = instance.get_topic_tags_list()
        return ret

    def to_internal_value(self, data):
        """Convert topic_tags from list to comma-separated string for input."""
        tags = data.get('topic_tags')
        if tags is not None and isinstance(tags, list):
            data = data.copy()
            data['topic_tags'] = ','.join(tags)
        return super().to_internal_value(data)
    
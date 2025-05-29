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

    class Meta:
        model = Goal
        fields = [
            'id', 
            'category', 
            'daily_target', 
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

    def validate_category(self, value):
        user = self.context['request'].user
        if self.instance is None:
            if Goal.objects.filter(user=user, category=value).exists():
                raise serializers.ValidationError("goal with this category already exists.")
        return value    
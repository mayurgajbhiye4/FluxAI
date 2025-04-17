from django.contrib import admin
from .models import *

# Register your models here.
admin.site.register(CustomUser) 
admin.site.register(Profile) 
admin.site.register(Task) 


@admin.register(Goal)
class GoalAdmin(admin.ModelAdmin):
    list_display = ('user', 'category', 'daily_target', 'weekly_streak', 'last_updated')
    list_filter = ('category', 'last_updated')
    search_fields = ('user__username', 'user__email', 'category')
    ordering = ('category', 'user')
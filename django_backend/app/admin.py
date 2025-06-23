from django.contrib import admin
from .models import *

# Register your models here.
admin.site.register(CustomUser) 
admin.site.register(Task) 
admin.site.register(AISummary) 


@admin.register(Goal)
class GoalAdmin(admin.ModelAdmin):
    list_display = ('user', 'category', 'daily_target', 'weekly_streak', 'last_completed_date')
    list_filter = ('category', 'last_completed_date')
    search_fields = ('user__username', 'user__email', 'category')
    ordering = ('category',)
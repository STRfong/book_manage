"""
使用者帳號相關 URL 路由
"""
from django.urls import path
from apps.accounts import views

app_name = 'accounts'

urlpatterns = [
    path('preference/', views.PreferenceView.as_view(), name='preference'),
    path('api/preference/', views.PreferenceAPIView.as_view(), name='preference_api'),
]

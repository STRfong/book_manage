"""
使用者帳號相關 Views
"""
from django.views.generic import TemplateView, View
from django.contrib.auth.mixins import LoginRequiredMixin
from django.http import JsonResponse
from django.shortcuts import render
import json

from apps.accounts.services import UserPreferenceService
from apps.accounts.models import UserPreference


class PreferenceView(LoginRequiredMixin, TemplateView):
    """使用者偏好設定頁面"""
    template_name = 'accounts/preference.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        preference = UserPreferenceService.get_or_create_preference(self.request.user)
        context['preference'] = preference
        context['frequency_choices'] = UserPreference.NotificationFrequency.choices
        return context


class PreferenceAPIView(LoginRequiredMixin, View):
    """使用者偏好設定 API"""

    def post(self, request):
        """更新偏好設定"""
        try:
            data = json.loads(request.body)

            # 驗證頻率選項
            valid_frequencies = [choice[0] for choice in UserPreference.NotificationFrequency.choices]
            if 'stock_alert_frequency' in data:
                if data['stock_alert_frequency'] not in valid_frequencies:
                    return JsonResponse({
                        'success': False,
                        'message': '無效的通知頻率',
                    }, status=400)

            # 更新偏好設定
            preference = UserPreferenceService.update_preference(
                user=request.user,
                **data
            )

            return JsonResponse({
                'success': True,
                'message': '設定已更新',
                'data': {
                    'stock_alert_frequency': preference.stock_alert_frequency,
                    'email_notification': preference.email_notification,
                    'browser_notification': preference.browser_notification,
                }
            })

        except json.JSONDecodeError:
            return JsonResponse({
                'success': False,
                'message': '無效的請求格式',
            }, status=400)
        except Exception as e:
            return JsonResponse({
                'success': False,
                'message': str(e),
            }, status=500)

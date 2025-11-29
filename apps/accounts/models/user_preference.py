"""
使用者偏好設定 Model

儲存使用者的個人化設定，例如通知頻率
"""
from django.db import models
from django.conf import settings


class UserPreference(models.Model):
    """使用者偏好設定"""

    # 通知頻率選項
    class NotificationFrequency(models.TextChoices):
        EVERY_15_SEC = 'every_15_sec', '每 15 秒（測試用）'
        EVERY_MINUTE = 'every_minute', '每分鐘'
        HOURLY = 'hourly', '每小時'
        DAILY = 'daily', '每日'
        WEEKLY = 'weekly', '每週'
        DISABLED = 'disabled', '停用通知'

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='preference',
        verbose_name='使用者',
    )

    # 庫存警告通知頻率
    stock_alert_frequency = models.CharField(
        max_length=20,
        choices=NotificationFrequency.choices,
        default=NotificationFrequency.DAILY,
        verbose_name='庫存警告頻率',
        help_text='設定接收庫存不足通知的頻率',
    )

    # 是否啟用 Email 通知
    email_notification = models.BooleanField(
        default=True,
        verbose_name='Email 通知',
        help_text='是否接收 Email 通知',
    )

    # 是否啟用瀏覽器通知
    browser_notification = models.BooleanField(
        default=True,
        verbose_name='瀏覽器通知',
        help_text='是否接收瀏覽器即時通知',
    )

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='建立時間')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新時間')

    class Meta:
        verbose_name = '使用者偏好設定'
        verbose_name_plural = '使用者偏好設定'

    def __str__(self):
        return f'{self.user.username} 的偏好設定'

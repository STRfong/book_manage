"""
使用者偏好設定服務層

處理偏好設定相關的業務邏輯，包含動態排程管理
"""
from django.db import transaction
from django_celery_beat.models import PeriodicTask, IntervalSchedule, CrontabSchedule
import json


class UserPreferenceService:
    """使用者偏好設定服務"""

    # 頻率對應的排程設定
    FREQUENCY_SCHEDULES = {
        'every_15_sec': {'type': 'interval', 'every': 15, 'period': 'seconds'},
        'every_minute': {'type': 'interval', 'every': 1, 'period': 'minutes'},
        'hourly': {'type': 'interval', 'every': 1, 'period': 'hours'},
        'daily': {'type': 'crontab', 'hour': 9, 'minute': 0},
        'weekly': {'type': 'crontab', 'hour': 9, 'minute': 0, 'day_of_week': 1},
    }

    @classmethod
    def get_or_create_preference(cls, user):
        """
        取得或建立使用者偏好設定

        Args:
            user: User instance

        Returns:
            UserPreference instance
        """
        from apps.accounts.models import UserPreference

        preference, created = UserPreference.objects.get_or_create(user=user)
        if created:
            # 新建立的偏好設定，建立對應的定時任務
            cls.sync_user_schedule(preference)
        return preference

    @classmethod
    @transaction.atomic
    def update_preference(cls, user, **kwargs):
        """
        更新使用者偏好設定

        Args:
            user: User instance
            **kwargs: 要更新的欄位

        Returns:
            UserPreference instance
        """
        preference = cls.get_or_create_preference(user)

        # 檢查是否有更新通知頻率
        frequency_changed = (
            'stock_alert_frequency' in kwargs and
            kwargs['stock_alert_frequency'] != preference.stock_alert_frequency
        )

        # 更新欄位
        for key, value in kwargs.items():
            if hasattr(preference, key):
                setattr(preference, key, value)
        preference.save()

        # 如果頻率改變，同步更新排程
        if frequency_changed:
            cls.sync_user_schedule(preference)

        return preference

    @classmethod
    def sync_user_schedule(cls, preference):
        """
        同步使用者的定時任務排程

        根據使用者的偏好設定，建立或更新 Celery Beat 排程

        Args:
            preference: UserPreference instance
        """
        task_name = f'user_{preference.user.id}_stock_alert'
        frequency = preference.stock_alert_frequency

        # 如果停用通知，刪除排程
        if frequency == 'disabled':
            PeriodicTask.objects.filter(name=task_name).delete()
            return

        # 取得排程設定
        schedule_config = cls.FREQUENCY_SCHEDULES.get(frequency)
        if not schedule_config:
            return

        # 建立排程
        if schedule_config['type'] == 'interval':
            schedule, _ = IntervalSchedule.objects.get_or_create(
                every=schedule_config['every'],
                period=getattr(IntervalSchedule, schedule_config['period'].upper()),
            )
            schedule_field = 'interval'
        else:
            schedule, _ = CrontabSchedule.objects.get_or_create(
                hour=schedule_config.get('hour', '*'),
                minute=schedule_config.get('minute', '*'),
                day_of_week=schedule_config.get('day_of_week', '*'),
                day_of_month=schedule_config.get('day_of_month', '*'),
                month_of_year=schedule_config.get('month_of_year', '*'),
            )
            schedule_field = 'crontab'

        # 建立或更新定時任務
        task_defaults = {
            schedule_field: schedule,
            'task': 'apps.library.tasks.check_low_stock_books_for_user',
            'kwargs': json.dumps({'user_id': preference.user.id}),
            'enabled': True,
        }

        # 清除另一種排程類型
        if schedule_field == 'interval':
            task_defaults['crontab'] = None
        else:
            task_defaults['interval'] = None

        PeriodicTask.objects.update_or_create(
            name=task_name,
            defaults=task_defaults,
        )

    @classmethod
    def delete_user_schedule(cls, user):
        """
        刪除使用者的定時任務排程

        Args:
            user: User instance
        """
        task_name = f'user_{user.id}_stock_alert'
        PeriodicTask.objects.filter(name=task_name).delete()

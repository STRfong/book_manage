from django.db import models
from django.conf import settings


class ReadingList(models.Model):
    """
    閱讀清單（我的最愛）
    記錄使用者收藏了哪些書
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,  # 使用 settings.AUTH_USER_MODEL 而不是直接寫 'User'
        on_delete=models.CASCADE,
        related_name='reading_lists',
        verbose_name='使用者'
    )

    book = models.ForeignKey(
        'library.Book',
        on_delete=models.CASCADE,
        related_name='in_reading_lists',
        verbose_name='書籍'
    )

    added_date = models.DateTimeField(
        auto_now_add=True,
        verbose_name='加入日期'
    )

    class Meta:
        verbose_name = '閱讀清單'
        verbose_name_plural = '閱讀清單'
        # 每個使用者對每本書只能加入一次
        unique_together = ['user', 'book']
        # 最新加入的排在前面
        ordering = ['-added_date']

    def __str__(self):
        return f"{self.user.username} - {self.book.title}"

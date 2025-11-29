"""
Celery 任務定義

這裡定義所有 library app 的背景任務
"""
import csv
import os
from datetime import datetime
from celery import shared_task
from django.conf import settings


@shared_task(bind=True)
def export_books_to_csv(self, user_id: int):
    """
    匯出書籍列表為 CSV 檔案

    Args:
        self: Celery task instance（因為 bind=True）
        user_id: 發起請求的使用者 ID

    Returns:
        dict: 包含檔案路徑和訊息
    """
    # 這裡必須在函數內 import，避免 Django 尚未初始化
    from apps.library.models.book import Book

    print(f"[Task] 開始匯出書籍報表，任務 ID: {self.request.id}")

    # 1. 查詢所有書籍
    books = Book.objects.select_related('publisher').all()
    total_books = books.count()

    print(f"[Task] 共有 {total_books} 本書籍要匯出")

    # 2. 建立匯出目錄（如果不存在）
    export_dir = os.path.join(settings.BASE_DIR, 'exports')
    os.makedirs(export_dir, exist_ok=True)

    # 3. 產生檔案名稱（包含時間戳記）
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f'books_export_{timestamp}.csv'
    filepath = os.path.join(export_dir, filename)

    # 4. 寫入 CSV 檔案
    with open(filepath, 'w', newline='', encoding='utf-8-sig') as csvfile:
        writer = csv.writer(csvfile)

        # 寫入標題列
        writer.writerow(['ID', '書名', '價格', '庫存', '出版社'])

        # 寫入資料列
        for book in books:
            writer.writerow([
                book.id,
                book.title,
                book.price,
                book.stock,
                book.publisher.name if book.publisher else '無',
            ])

    print(f"[Task] 匯出完成：{filepath}")

    # 5. 發送 WebSocket 通知
    notify_export_complete(user_id, filename)

    return {
        'status': 'success',
        'filename': filename,
        'total_books': total_books,
        'message': f'成功匯出 {total_books} 本書籍',
    }


def notify_export_complete(user_id: int, filename: str):
    """
    透過 WebSocket 通知使用者匯出完成

    Args:
        user_id: 使用者 ID
        filename: 匯出的檔案名稱
    """
    from channels.layers import get_channel_layer
    from asgiref.sync import async_to_sync

    channel_layer = get_channel_layer()

    # 發送到 book_updates 群組
    async_to_sync(channel_layer.group_send)(
        'book_updates',
        {
            'type': 'book_update',
            'action': 'export_complete',
            'message': f'報表匯出完成！檔案：{filename}',
        }
    )

    print(f"[Task] 已發送 WebSocket 通知給使用者")

@shared_task
def check_low_stock_books():
    """
    檢查庫存不足的書籍（定時任務）

    這個任務會由 Celery Beat 定時執行
    """
    from apps.library.models.book import Book
    from channels.layers import get_channel_layer
    from asgiref.sync import async_to_sync

    print("[定時任務] 開始檢查庫存...")

    # 查詢庫存低於 5 的書籍
    low_stock_books = Book.objects.filter(stock__lt=5)
    count = low_stock_books.count()

    if count > 0:
        # 組裝訊息
        book_titles = [book.title for book in low_stock_books[:5]]  # 最多顯示 5 本
        if count > 5:
            message = f'庫存警告：{", ".join(book_titles)} 等 {count} 本書籍庫存不足！'
        else:
            message = f'庫存警告：{", ".join(book_titles)} 庫存不足！'

        print(f"[定時任務] 發現 {count} 本書籍庫存不足")

        # 透過 WebSocket 發送通知
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            'book_updates',
            {
                'type': 'book_update',
                'action': 'low_stock_warning',
                'message': message,
            }
        )
    else:
        print("[定時任務] 所有書籍庫存正常")

    return {
        'status': 'success',
        'low_stock_count': count,
    }

@shared_task
def check_low_stock_books_for_user(user_id: int):
    """
    檢查庫存不足的書籍（針對特定使用者的定時任務）

    這個任務會根據使用者的偏好設定被觸發

    Args:
        user_id: 使用者 ID
    """
    from apps.library.models.book import Book
    from apps.accounts.models import User
    from channels.layers import get_channel_layer
    from asgiref.sync import async_to_sync

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        print(f"[定時任務] 使用者 {user_id} 不存在")
        return {'status': 'error', 'message': 'User not found'}

    print(f"[定時任務] 為使用者 {user.username} 檢查庫存...")

    # 查詢庫存低於 5 的書籍
    low_stock_books = Book.objects.filter(stock__lt=5)
    count = low_stock_books.count()

    if count > 0:
        # 組裝訊息
        book_titles = [book.title for book in low_stock_books[:5]]
        if count > 5:
            message = f'庫存警告：{", ".join(book_titles)} 等 {count} 本書籍庫存不足！'
        else:
            message = f'庫存警告：{", ".join(book_titles)} 庫存不足！'

        print(f"[定時任務] 發現 {count} 本書籍庫存不足，通知使用者 {user.username}")

        # 透過 WebSocket 發送通知
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            'book_updates',
            {
                'type': 'book_update',
                'action': 'low_stock_warning',
                'message': message,
                'user_id': user_id,  # 可用於前端過濾
            }
        )
    else:
        print(f"[定時任務] 使用者 {user.username} - 所有書籍庫存正常")

    return {
        'status': 'success',
        'user_id': user_id,
        'low_stock_count': count,
    }

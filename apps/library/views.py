from django.shortcuts import render, redirect, get_object_or_404
from django.views import View
from django.http import HttpResponse, JsonResponse
from .models.book import Book
from .models.publisher import Publisher
from django.shortcuts import render, redirect, get_object_or_404
from django.views import View
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib import messages
from .models.book import Book
from .models.reading_list import ReadingList
from django.core.cache import cache
import time
# Create your views here.
class HelloWorldView(View):
    def get(self, request):
        return HttpResponse("哈囉，Eason")

class HelloEasonView(View):
    def get(self, request):
        return HttpResponse("哈哈哈哈哈我是 Eason")

class HelloStudentView(View):
    def get(self, request, student_name):
        print(request.GET)
        hello_way = request.GET.get('hello_way')
        if hello_way:
            return HttpResponse(f"哈囉，{student_name}，{hello_way}")
        else:
            return HttpResponse(f"哈囉，{student_name}")

class JsonResponseView(View):
    def get(self, request):
        return_msg = {
            'message': 'Hello, World!',
            'status': 'success',
            'code': 200,
            'data': {
                'name': 'Eason',
                'age': 20,
            }
        }
        # return JsonResponse(return_msg)
        return redirect('library:hello_world')


class BookListView(View):
    """書籍列表頁 - 只渲染頁面骨架，資料透過 AJAX 載入"""

    def get(self, request):
        # 只傳遞出版社資料給表單使用（Modal 新增/編輯需要）
        context = {
            'publishers': Publisher.objects.all(),
        }
        return render(request, 'library/book_list.html', context)


class BookListAPIView(View):
    """書籍列表 API - 回傳 JSON 資料（有快取）"""

    CACHE_KEY = 'api_book_list'
    CACHE_TIMEOUT = 60  # 快取 60 秒

    def get(self, request):
        # ========== 快取機制 ==========
        # 嘗試從快取取得書籍資料
        cached_books = cache.get(self.CACHE_KEY)

        if cached_books:
            # 快取命中！
            print(f"[Cache HIT] {self.CACHE_KEY}")
            books_data = cached_books
        else:
            # 快取未命中，查詢資料庫
            print(f"[Cache MISS] {self.CACHE_KEY}")
            books = Book.objects.select_related('publisher').all()

            # 組裝書籍資料
            books_data = []
            for book in books:
                books_data.append({
                    'id': book.id,
                    'title': book.title,
                    'price': book.price,
                    'stock': book.stock,
                    'publisher': {
                        'id': book.publisher.id if book.publisher else None,
                        'name': book.publisher.name if book.publisher else None,
                    } if book.publisher else None,
                })

            # 存入快取
            cache.set(self.CACHE_KEY, books_data, self.CACHE_TIMEOUT)
            print(f"[Cache SET] {self.CACHE_KEY}")
        # ========== 快取機制結束 ==========

        # 取得使用者已收藏的書籍 ID（這部分不快取，因為每個使用者不同）
        user_favorite_book_ids = []
        if request.user.is_authenticated:
            user_favorite_book_ids = list(
                ReadingList.objects.filter(user=request.user).values_list('book_id', flat=True)
            )

        return JsonResponse({
            'success': True,
            'data': {
                'books': books_data,
                'user_favorite_book_ids': user_favorite_book_ids,
                'is_authenticated': request.user.is_authenticated,
            }
        })



class BookDetailView(View):
    """書籍詳細頁"""

    def get(self, request, book_id):
        # 使用 get_object_or_404 處理不存在的情況
        book = get_object_or_404(Book.objects.select_related('publisher'), id=book_id)

        context = {
            'book': book,
        }

        return render(request, 'library/book_detail.html', context)
class BookCreateView(View):
    """新增書籍"""

    def get(self, request):
        # 取得所有出版社，供表單選擇
        publishers = Publisher.objects.all()

        context = {
            'publishers': publishers,
        }

        return render(request, 'library/book_form.html', context)

    def post(self, request):
        # 取得表單資料
        title = request.POST.get('title')
        price = request.POST.get('price')
        stock = request.POST.get('stock')
        publisher_id = request.POST.get('publisher')

        # 簡單驗證
        errors = []

        if not title:
            errors.append('書名不能為空')

        try:
            price = int(price)
            if price < 0:
                raise ValueError
        except (ValueError, TypeError):
            errors.append('價格必須是正整數')

        try:
            stock = int(stock)
            if stock < 0:
                raise ValueError
        except (ValueError, TypeError):
            errors.append('庫存必須是正整數')

        if not publisher_id:
            errors.append('請選擇出版社')

        # 如果有錯誤，返回表單並顯示錯誤訊息
        if errors:
            publishers = Publisher.objects.all()
            return render(request, 'library/book_form.html', {
                'errors': errors,
                'publishers': publishers,
                'title': title,
                'price': price,
                'stock': stock,
                'publisher_id': publisher_id,
            })

        # 沒有錯誤，建立書籍
        publisher = get_object_or_404(Publisher, id=publisher_id)
        book = Book.objects.create(
            title=title,
            price=price,
            stock=stock,
            publisher=publisher,
        )

        cache.delete('api_book_list')
        # 重定向到書籍列表頁
        return redirect('library:book_list')

class BookEditView(View):
    """編輯書籍"""

    def get(self, request, book_id):
        # 取得書籍資料
        book = get_object_or_404(Book.objects.select_related('publisher'), id=book_id)
        publishers = Publisher.objects.all()

        context = {
            'book': book,
            'publishers': publishers,
            'is_edit': True,
        }

        return render(request, 'library/book_form.html', context)

    def post(self, request, book_id):
        # 取得書籍
        book = get_object_or_404(Book, id=book_id)

        # 取得表單資料
        title = request.POST.get('title')
        price = request.POST.get('price')
        stock = request.POST.get('stock')
        publisher_id = request.POST.get('publisher')

        # 驗證
        errors = []

        if not title:
            errors.append('書名不能為空')

        try:
            price = int(price)
            if price < 0:
                raise ValueError
        except (ValueError, TypeError):
            errors.append('價格必須是正整數')

        try:
            stock = int(stock)
            if stock < 0:
                raise ValueError
        except (ValueError, TypeError):
            errors.append('庫存必須是正整數')

        if not publisher_id:
            errors.append('請選擇出版社')

        # 如果有錯誤，返回表單
        if errors:
            publishers = Publisher.objects.all()
            return render(request, 'library/book_form.html', {
                'errors': errors,
                'book': book,
                'publishers': publishers,
                'is_edit': True,
            })

        # 更新書籍資料
        book.title = title
        book.price = price
        book.stock = stock
        book.publisher = get_object_or_404(Publisher, id=publisher_id)
        book.save()

        cache.delete('api_book_list')
        # 重定向到書籍詳細頁
        return redirect('library:book_detail', book_id=book.id)


class BookDeleteView(View):
    """刪除書籍"""

    def get(self, request, book_id):
        # 顯示刪除確認頁面
        book = get_object_or_404(Book.objects.select_related('publisher'), id=book_id)

        context = {
            'book': book,
        }

        return render(request, 'library/book_delete.html', context)

    def post(self, request, book_id):
        # 執行刪除
        book = get_object_or_404(Book, id=book_id)
        book.delete()

        cache.delete('api_book_list')
        # 重定向到列表頁
        return redirect('library:book_list')


# ==================== 出版社管理 ====================

class PublisherListView(View):
    """出版社列表頁"""

    def get(self, request):
        # 取得所有出版社，並計算每個出版社的書籍數量
        publishers = Publisher.objects.all()

        # 為每個出版社加上書籍數量
        for publisher in publishers:
            publisher.book_count = Book.objects.filter(publisher=publisher).count()

        context = {
            'publishers': publishers,
        }

        return render(request, 'library/publisher_list.html', context)


class PublisherCreateView(View):
    """新增出版社"""

    def get(self, request):
        return render(request, 'library/publisher_form.html')

    def post(self, request):
        # 取得表單資料
        name = request.POST.get('name')
        city = request.POST.get('city')

        # 驗證
        errors = []

        if not name:
            errors.append('出版社名稱不能為空')

        if not city:
            errors.append('城市不能為空')

        # 檢查名稱是否重複
        if name and Publisher.objects.filter(name=name).exists():
            errors.append('此出版社名稱已存在')

        # 如果有錯誤，返回表單並顯示錯誤訊息
        if errors:
            return render(request, 'library/publisher_form.html', {
                'errors': errors,
                'name': name,
                'city': city,
            })

        # 建立出版社
        publisher = Publisher.objects.create(
            name=name,
            city=city,
        )

        # 重定向到出版社列表頁
        return redirect('library:publisher_list')


class PublisherEditView(View):
    """編輯出版社"""

    def get(self, request, publisher_id):
        # 取得出版社資料
        publisher = get_object_or_404(Publisher, id=publisher_id)

        context = {
            'publisher': publisher,
            'is_edit': True,
        }

        return render(request, 'library/publisher_form.html', context)

    def post(self, request, publisher_id):
        # 取得出版社
        publisher = get_object_or_404(Publisher, id=publisher_id)

        # 取得表單資料
        name = request.POST.get('name')
        city = request.POST.get('city')

        # 驗證
        errors = []

        if not name:
            errors.append('出版社名稱不能為空')

        if not city:
            errors.append('城市不能為空')

        # 檢查名稱是否重複（排除自己）
        if name and Publisher.objects.filter(name=name).exclude(id=publisher_id).exists():
            errors.append('此出版社名稱已存在')

        # 如果有錯誤，返回表單
        if errors:
            return render(request, 'library/publisher_form.html', {
                'errors': errors,
                'publisher': publisher,
                'is_edit': True,
            })

        # 更新出版社資料
        publisher.name = name
        publisher.city = city
        publisher.save()

        # 重定向到出版社列表頁
        return redirect('library:publisher_list')


class PublisherDeleteView(View):
    """刪除出版社"""

    def get(self, request, publisher_id):
        # 顯示刪除確認頁面
        publisher = get_object_or_404(Publisher, id=publisher_id)

        # 計算關聯的書籍數量
        book_count = Book.objects.filter(publisher=publisher).count()

        context = {
            'publisher': publisher,
            'book_count': book_count,
        }

        return render(request, 'library/publisher_delete.html', context)

    def post(self, request, publisher_id):
        # 執行刪除
        publisher = get_object_or_404(Publisher, id=publisher_id)

        # 檢查是否有關聯的書籍
        book_count = Book.objects.filter(publisher=publisher).count()

        if book_count > 0:
            # 如果有關聯的書籍，不允許刪除
            return render(request, 'library/publisher_delete.html', {
                'publisher': publisher,
                'book_count': book_count,
                'error': f'無法刪除！此出版社還有 {book_count} 本書籍關聯，請先刪除或轉移這些書籍。',
            })

        publisher.delete()

        # 重定向到列表頁
        return redirect('library:publisher_list')


class AddToReadingListView(LoginRequiredMixin, View):
    """加入閱讀清單"""

    def get(self, request, book_id):
        book = get_object_or_404(Book, id=book_id)

        # 檢查是否已經在清單中
        already_exists = ReadingList.objects.filter(
            user=request.user,
            book=book
        ).exists()

        if already_exists:
            messages.warning(request, f'《{book.title}》已經在你的最愛清單中了！')
        else:
            ReadingList.objects.create(user=request.user, book=book)
            messages.success(request, f'已將《{book.title}》加入最愛！')

        # 導回上一頁
        return redirect(request.META.get('HTTP_REFERER', 'library:book_list'))


class RemoveFromReadingListView(LoginRequiredMixin, View):
    """從閱讀清單移除"""

    def get(self, request, book_id):
        book = get_object_or_404(Book, id=book_id)

        reading_list_item = ReadingList.objects.filter(
            user=request.user,
            book=book
        ).first()

        if reading_list_item:
            reading_list_item.delete()
            messages.success(request, f'已將《{book.title}》從最愛移除！')
        else:
            messages.warning(request, f'《{book.title}》不在你的最愛清單中！')

        return redirect(request.META.get('HTTP_REFERER', 'library:book_list'))


class MyReadingListView(LoginRequiredMixin, View):
    """我的閱讀清單頁面"""

    def get(self, request):
        reading_lists = ReadingList.objects.filter(
            user=request.user
        ).select_related('book', 'book__publisher')

        context = {
            'reading_lists': reading_lists,
        }
        return render(request, 'library/my_reading_list.html', context)

# ==================== AJAX API ====================

class AddToReadingListAPIView(LoginRequiredMixin, View):
    """加入閱讀清單 API（AJAX 版本）"""

    def post(self, request, book_id):
        """
        使用 POST 方法（更符合 RESTful 原則）
        """
        book = get_object_or_404(Book, id=book_id)

        # 檢查是否已經在清單中
        already_exists = ReadingList.objects.filter(
            user=request.user,
            book=book
        ).exists()

        if already_exists:
            return JsonResponse({
                'success': False,
                'message': f'《{book.title}》已經在你的最愛清單中了！'
            }, status=400)  # 400 Bad Request

        # 建立閱讀清單項目
        ReadingList.objects.create(user=request.user, book=book)

        return JsonResponse({
            'success': True,
            'message': f'已將《{book.title}》加入最愛！',
            'book_id': book_id
        })


class RemoveFromReadingListAPIView(LoginRequiredMixin, View):
    """從閱讀清單移除 API（AJAX 版本）"""

    def post(self, request, book_id):
        """
        使用 POST 方法（也可以用 DELETE，但 POST 較簡單）
        """
        book = get_object_or_404(Book, id=book_id)

        reading_list_item = ReadingList.objects.filter(
            user=request.user,
            book=book
        ).first()

        if not reading_list_item:
            return JsonResponse({
                'success': False,
                'message': f'《{book.title}》不在你的最愛清單中！'
            }, status=400)

        reading_list_item.delete()

        return JsonResponse({
            'success': True,
            'message': f'已將《{book.title}》從最愛移除！',
            'book_id': book_id
        })

# ==================== 匯出功能 ====================

class ExportBooksView(LoginRequiredMixin, View):
    """匯出書籍報表 API"""

    def post(self, request):
        from apps.library.tasks import export_books_to_csv

        # 發送任務到 Celery
        task = export_books_to_csv.delay(user_id=request.user.id)

        return JsonResponse({
            'success': True,
            'message': '報表產生中，完成後會通知您！',
            'task_id': task.id,
        })

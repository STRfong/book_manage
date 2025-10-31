from django.shortcuts import render, redirect, get_object_or_404
from django.views import View
from django.http import HttpResponse, JsonResponse
from .models.book import Book
from .models.publisher import Publisher
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
    """書籍列表頁"""

    def get(self, request):
        # 從資料庫取得所有書籍和出版社
        books = Book.objects.select_related('publisher').all()
        publishers = Publisher.objects.all()

        # 準備要傳給 Template 的資料
        context = {
            'books': books,
            'publishers': publishers,
        }

        # 渲染 Template 並返回
        return render(request, 'library/book_list.html', context)

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

from django.contrib import admin
from .models import Book
from .models import BookDetail
from .models import Publisher
from .models import Author

@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = ('title', 'price', 'stock', 'publisher')  # 列表顯示欄位
    list_filter = ('authors',)  # 篩選器
    search_fields = ('title', 'authors')  # 搜尋欄位
    ordering = ('-price',)  # 預設排序

@admin.register(BookDetail)
class BookDetailAdmin(admin.ModelAdmin):
    list_display = ('book', 'isbn', 'publisher', 'publish_date', 'pages', 'description', 'cover_image')
    list_filter = ('publisher', 'publish_date')
    search_fields = ('book__title', 'isbn', 'publisher')
    ordering = ('-publish_date',)

@admin.register(Publisher)
class PublisherAdmin(admin.ModelAdmin):
    list_display = ('name', 'city')
    search_fields = ('name', 'city')
    ordering = ('-name',)

@admin.register(Author)
class AuthorAdmin(admin.ModelAdmin):
    list_display = ('name', 'bio', 'birth_date', 'nationality')
    search_fields = ('name', 'bio', 'birth_date', 'nationality')
    ordering = ('-birth_date',)
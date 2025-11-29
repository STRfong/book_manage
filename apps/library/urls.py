from django.urls import path
from . import views

app_name = 'library'

urlpatterns = [
    path('', views.HelloWorldView.as_view(), name='hello_world'),
    # path('<str:student_name>/', views.HelloStudentView.as_view(), name='hello_student'),

    # 書籍管理
    path('book/<int:book_id>/', views.BookDetailView.as_view(), name='book_detail'),
    # path('jsonresponse/', views.JsonResponseView.as_view(), name='json_response'),
    path('book_list/', views.BookListView.as_view(), name='book_list'),
    path('book_create/', views.BookCreateView.as_view(), name='book_create'),
    path('book_edit/<int:book_id>/', views.BookEditView.as_view(), name='book_edit'),
    path('book_delete/<int:book_id>/', views.BookDeleteView.as_view(), name='book_delete'),

    # 出版社管理
    path('publishers/', views.PublisherListView.as_view(), name='publisher_list'),
    path('publisher_create/', views.PublisherCreateView.as_view(), name='publisher_create'),
    path('publisher_edit/<int:publisher_id>/', views.PublisherEditView.as_view(), name='publisher_edit'),
    path('publisher_delete/<int:publisher_id>/', views.PublisherDeleteView.as_view(), name='publisher_delete'),

    # 閱讀清單相關
    path('reading-list/', views.MyReadingListView.as_view(), name='my_reading_list'),
    path('reading-list/add/<int:book_id>/', views.AddToReadingListView.as_view(), name='add_to_reading_list'),
    path('reading-list/remove/<int:book_id>/', views.RemoveFromReadingListView.as_view(), name='remove_from_reading_list'),

    # AJAX API 端點
    path('api/books/', views.BookListAPIView.as_view(), name='api_book_list'),
    path('api/reading-list/add/<int:book_id>/', views.AddToReadingListAPIView.as_view(), name='api_add_to_reading_list'),
    path('api/reading-list/remove/<int:book_id>/', views.RemoveFromReadingListAPIView.as_view(), name='api_remove_from_reading_list'),
    path('api/export/', views.ExportBooksView.as_view(), name='export_books'),  # 新增這行
]

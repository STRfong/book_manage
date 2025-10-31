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
]

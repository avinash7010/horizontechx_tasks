from django.urls import path

from . import views

app_name = 'store'

urlpatterns = [
    path('', views.product_list, name='product_list'),
    path('products/<slug:slug>/', views.product_detail, name='product_detail'),
    path('cart/', views.cart_detail, name='cart_detail'),
    path('cart/add/<int:product_id>/', views.add_to_cart, name='add_to_cart'),
    path('cart/update/<int:product_id>/', views.update_cart, name='update_cart'),
    path('cart/remove/<int:product_id>/', views.remove_from_cart, name='remove_from_cart'),
    path('checkout/', views.checkout, name='checkout'),
    path('orders/', views.my_orders, name='my_orders'),
    path('orders/<uuid:tracking_number>/', views.order_detail, name='order_detail'),
    path('track/', views.track_order, name='track_order'),
    path('register/', views.register, name='register'),
]
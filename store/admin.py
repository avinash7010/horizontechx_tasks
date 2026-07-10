from django.contrib import admin
from django.utils.html import format_html

from .models import Order, OrderItem, Product


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
	list_display = ('image_preview', 'name', 'price', 'stock', 'is_active', 'created_at')
	list_filter = ('is_active', 'created_at')
	search_fields = ('name', 'description')
	prepopulated_fields = {'slug': ('name',)}
	readonly_fields = ('created_at', 'updated_at')

	def image_preview(self, obj):
		if obj.image:
			return format_html('<img src="{}" style="width: 48px; height: 48px; object-fit: cover; border-radius: 10px;" />', obj.image.url)
		if obj.image_url:
			return format_html('<img src="{}" style="width: 48px; height: 48px; object-fit: cover; border-radius: 10px;" />', obj.image_url)
		return 'No image'

	image_preview.short_description = 'Preview'


class OrderItemInline(admin.TabularInline):
	model = OrderItem
	extra = 0
	readonly_fields = ('unit_price',)


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
	list_display = ('tracking_number', 'full_name', 'email', 'status', 'total_amount', 'created_at')
	list_filter = ('status', 'created_at')
	search_fields = ('tracking_number', 'full_name', 'email')
	readonly_fields = ('tracking_number', 'total_amount', 'created_at', 'updated_at')
	inlines = [OrderItemInline]

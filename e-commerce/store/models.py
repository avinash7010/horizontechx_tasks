import uuid
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.urls import reverse
from django.utils.text import slugify


class Product(models.Model):
	name = models.CharField(max_length=200)
	slug = models.SlugField(max_length=220, unique=True, blank=True)
	description = models.TextField()
	price = models.DecimalField(max_digits=10, decimal_places=2)
	stock = models.PositiveIntegerField(default=0)
	image = models.ImageField(upload_to='products/', blank=True, null=True)
	image_url = models.URLField(blank=True)
	is_active = models.BooleanField(default=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ['-created_at']

	def save(self, *args, **kwargs):
		if not self.slug:
			self.slug = slugify(self.name)
		super().save(*args, **kwargs)

	def __str__(self):
		return self.name

	def get_absolute_url(self):
		return reverse('store:product_detail', args=[self.slug])


class Order(models.Model):
	class Status(models.TextChoices):
		PENDING = 'pending', 'Pending'
		PROCESSING = 'processing', 'Processing'
		SHIPPED = 'shipped', 'Shipped'
		DELIVERED = 'delivered', 'Delivered'
		CANCELLED = 'cancelled', 'Cancelled'

	tracking_number = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
	user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='orders')
	full_name = models.CharField(max_length=200)
	email = models.EmailField()
	shipping_address = models.CharField(max_length=255)
	city = models.CharField(max_length=100)
	state = models.CharField(max_length=100)
	postal_code = models.CharField(max_length=20)
	status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
	total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ['-created_at']

	def __str__(self):
		return f'Order {self.tracking_number}'

	def recalculate_total(self):
		total = sum((item.line_total for item in self.items.all()), Decimal('0.00'))
		self.total_amount = total
		self.save(update_fields=['total_amount', 'updated_at'])


class OrderItem(models.Model):
	order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
	product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='order_items')
	quantity = models.PositiveIntegerField(default=1)
	unit_price = models.DecimalField(max_digits=10, decimal_places=2)

	class Meta:
		constraints = [
			models.UniqueConstraint(fields=['order', 'product'], name='unique_order_product')
		]

	def __str__(self):
		return f'{self.product.name} x {self.quantity}'

	@property
	def line_total(self):
		return self.unit_price * self.quantity

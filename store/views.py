from decimal import Decimal

from django.contrib import messages
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.shortcuts import get_object_or_404, redirect, render

from .forms import CheckoutForm, RegistrationForm, TrackingForm
from .models import Order, OrderItem, Product


def get_cart(request):
	return request.session.setdefault('cart', {})


def cart_products(request):
	cart = request.session.get('cart', {})
	product_ids = [int(product_id) for product_id in cart.keys()]
	products = Product.objects.filter(id__in=product_ids, is_active=True)
	product_map = {product.id: product for product in products}
	items = []
	subtotal = Decimal('0.00')

	for product_id_str, quantity in cart.items():
		product = product_map.get(int(product_id_str))
		if not product:
			continue
		quantity = int(quantity)
		line_total = product.price * quantity
		subtotal += line_total
		items.append({
			'product': product,
			'quantity': quantity,
			'line_total': line_total,
		})

	return items, subtotal


def product_list(request):
	query = request.GET.get('q', '').strip()
	products = Product.objects.filter(is_active=True)
	if query:
		products = products.filter(name__icontains=query) | products.filter(description__icontains=query)
	return render(request, 'store/product_list.html', {
		'products': products.distinct(),
		'query': query,
	})


def product_detail(request, slug):
	product = get_object_or_404(Product, slug=slug, is_active=True)
	return render(request, 'store/product_detail.html', {'product': product})


def add_to_cart(request, product_id):
	product = get_object_or_404(Product, id=product_id, is_active=True)
	quantity = int(request.POST.get('quantity', 1)) if request.method == 'POST' else 1
	quantity = max(quantity, 1)
	cart = get_cart(request)
	cart[str(product.id)] = int(cart.get(str(product.id), 0)) + quantity
	request.session['cart'] = cart
	request.session.modified = True
	messages.success(request, f'{product.name} added to your cart.')
	return redirect('store:cart_detail')


def update_cart(request, product_id):
	if request.method != 'POST':
		return redirect('store:cart_detail')
	cart = get_cart(request)
	product_key = str(product_id)
	quantity = int(request.POST.get('quantity', 1))
	if quantity <= 0:
		cart.pop(product_key, None)
	else:
		cart[product_key] = quantity
	request.session['cart'] = cart
	request.session.modified = True
	return redirect('store:cart_detail')


def remove_from_cart(request, product_id):
	cart = get_cart(request)
	cart.pop(str(product_id), None)
	request.session['cart'] = cart
	request.session.modified = True
	messages.info(request, 'Item removed from your cart.')
	return redirect('store:cart_detail')


def cart_detail(request):
	items, subtotal = cart_products(request)
	return render(request, 'store/cart_detail.html', {
		'items': items,
		'subtotal': subtotal,
	})


@login_required
def checkout(request):
	items, subtotal = cart_products(request)
	if not items:
		messages.error(request, 'Your cart is empty.')
		return redirect('store:product_list')

	if request.method == 'POST':
		form = CheckoutForm(request.POST)
		if form.is_valid():
			with transaction.atomic():
				products = Product.objects.select_for_update().filter(id__in=[item['product'].id for item in items])
				product_map = {product.id: product for product in products}

				for item in items:
					product = product_map[item['product'].id]
					if product.stock < item['quantity']:
						messages.error(request, f'Not enough stock for {product.name}.')
						return redirect('store:cart_detail')

				order = form.save(commit=False)
				order.user = request.user
				order.total_amount = subtotal
				order.status = Order.Status.PROCESSING
				order.save()

				for item in items:
					product = product_map[item['product'].id]
					OrderItem.objects.create(
						order=order,
						product=product,
						quantity=item['quantity'],
						unit_price=product.price,
					)
					product.stock -= item['quantity']
					product.save(update_fields=['stock'])

				order.recalculate_total()
				request.session['cart'] = {}
				request.session.modified = True
				messages.success(request, 'Your order has been placed successfully.')
				return redirect('store:order_detail', tracking_number=order.tracking_number)
	else:
		form = CheckoutForm(initial={
			'full_name': request.user.get_full_name() or request.user.username,
			'email': request.user.email,
		})

	return render(request, 'store/checkout.html', {
		'form': form,
		'items': items,
		'subtotal': subtotal,
	})


@login_required
def my_orders(request):
	orders = request.user.orders.prefetch_related('items__product')
	return render(request, 'store/orders_list.html', {'orders': orders})


@login_required
def order_detail(request, tracking_number):
	order = get_object_or_404(Order.objects.prefetch_related('items__product'), tracking_number=tracking_number)
	if order.user_id != request.user.id and not request.user.is_staff:
		return redirect('store:product_list')
	return render(request, 'store/order_detail.html', {'order': order})


def track_order(request):
	form = TrackingForm(request.GET or None)
	order = None
	if form.is_valid():
		tracking_number = form.cleaned_data['tracking_number']
		order = Order.objects.prefetch_related('items__product').filter(tracking_number=tracking_number).first()
		if not order:
			messages.error(request, 'We could not find that tracking number.')
	return render(request, 'store/track_order.html', {
		'form': form,
		'order': order,
	})


def register(request):
	if request.user.is_authenticated:
		return redirect('store:product_list')

	if request.method == 'POST':
		form = RegistrationForm(request.POST)
		if form.is_valid():
			user = form.save()
			login(request, user)
			messages.success(request, 'Welcome to the store.')
			return redirect('store:product_list')
	else:
		form = RegistrationForm()

	return render(request, 'registration/register.html', {'form': form})

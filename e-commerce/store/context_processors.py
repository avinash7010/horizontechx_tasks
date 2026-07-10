def cart_summary(request):
    cart = request.session.get('cart', {})
    cart_count = sum(int(quantity) for quantity in cart.values())
    return {'cart_count': cart_count}
document.addEventListener('submit', (event) => {
  const form = event.target;
  if (!form.classList.contains('cart-update-form')) {
    return;
  }

  const quantityInput = form.querySelector('input[name="quantity"]');
  if (quantityInput && Number(quantityInput.value) < 0) {
    quantityInput.value = 0;
  }
});

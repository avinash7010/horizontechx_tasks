from decimal import Decimal

from django.db import migrations


def seed_products(apps, schema_editor):
    Product = apps.get_model('store', 'Product')
    Product.objects.create(
        name='Aurora Backpack',
        slug='aurora-backpack',
        description='Weather-resistant everyday backpack with laptop sleeve, hidden pocket, and clean minimal design.',
        price=Decimal('79.00'),
        stock=18,
        image_url='https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=80',
    )
    Product.objects.create(
        name='Studio Headphones',
        slug='studio-headphones',
        description='Comfort-fit wireless headphones with rich bass, long battery life, and quick charging.',
        price=Decimal('129.00'),
        stock=12,
        image_url='https://images.unsplash.com/photo-1518444032463-9b17f4b83e64?auto=format&fit=crop&w=900&q=80',
    )
    Product.objects.create(
        name='Everyday Watch',
        slug='everyday-watch',
        description='Clean analog watch with stainless steel casing, scratch-resistant glass, and versatile styling.',
        price=Decimal('99.00'),
        stock=22,
        image_url='https://images.unsplash.com/photo-1524592094714-0f0654e20314?auto=format&fit=crop&w=900&q=80',
    )


class Migration(migrations.Migration):
    dependencies = [
        ('store', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_products, migrations.RunPython.noop),
    ]

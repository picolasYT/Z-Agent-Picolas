// Variables globales
let cart = [];
let cartCount = 0;
let cartTotal = 0;

// Elementos del DOM
const cartIcon = document.querySelector('.cart-icon');
const cartOverlay = document.getElementById('cart-overlay');
const closeCartBtn = document.getElementById('close-cart');
const cartItemsContainer = document.getElementById('cart-items');
const cartTotalElement = document.getElementById('cart-total');
const cartCountElement = document.getElementById('cart-count');
const checkoutBtn = document.getElementById('checkout-btn');
const categoryBtns = document.querySelectorAll('.category-btn');
const menuItems = document.querySelectorAll('.menu-item');
const addToCartBtns = document.querySelectorAll('.add-to-cart');

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    loadCartFromLocalStorage();
    updateCartUI();
    setupEventListeners();
});

// Configurar event listeners
function setupEventListeners() {
    // Abrir carrito
    cartIcon.addEventListener('click', () => {
        cartOverlay.style.display = 'flex';
    });
    
    // Cerrar carrito
    closeCartBtn.addEventListener('click', () => {
        cartOverlay.style.display = 'none';
    });
    
    // Cerrar carrito al hacer clic fuera
    cartOverlay.addEventListener('click', (e) => {
        if (e.target === cartOverlay) {
            cartOverlay.style.display = 'none';
        }
    });
    
    // Botones de categoría
    categoryBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const category = btn.getAttribute('data-category');
            filterMenuItems(category);
            
            // Actualizar botón activo
            categoryBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
    
    // Botones de agregar al carrito
    addToCartBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.getAttribute('data-id'));
            const name = btn.getAttribute('data-name');
            const price = parseFloat(btn.getAttribute('data-price'));
            
            addToCart(id, name, price);
        });
    });
    
    // Botón de checkout
    checkoutBtn.addEventListener('click', () => {
        if (cart.length === 0) {
            alert('Tu carrito está vacío');
            return;
        }
        
        // Simular proceso de checkout
        alert(`¡Gracias por tu compra! Total: $${cartTotal.toFixed(2)}`);
        
        // Vaciar carrito
        cart = [];
        updateCartUI();
        saveCartToLocalStorage();
        cartOverlay.style.display = 'none';
    });
}

// Filtrar elementos del menú por categoría
function filterMenuItems(category) {
    menuItems.forEach(item => {
        const itemCategory = item.getAttribute('data-category');
        
        if (category === 'all' || itemCategory === category) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// Agregar producto al carrito
function addToCart(id, name, price) {
    // Verificar si el producto ya está en el carrito
    const existingItem = cart.find(item => item.id === id);
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id,
            name,
            price,
            quantity: 1
        });
    }
    
    updateCartUI();
    saveCartToLocalStorage();
}

// Actualizar UI del carrito
function updateCartUI() {
    // Actualizar contador
    cartCount = cart.reduce((total, item) => total + item.quantity, 0);
    cartCountElement.textContent = cartCount;
    
    // Actualizar total
    cartTotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    cartTotalElement.textContent = `$${cartTotal.toFixed(2)}`;
    
    // Actualizar items del carrito
    cartItemsContainer.innerHTML = '';
    
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p>Tu carrito está vacío</p>';
        return;
    }
    
    cart.forEach(item => {
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';
        cartItem.innerHTML = `
            <div class="cart-item-info">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-price">$${item.price.toFixed(2)}</div>
            </div>
            <div class="cart-item-quantity">
                <button class="quantity-btn" data-id="${item.id}">-</button>
                <span>${item.quantity}</span>
                <button class="quantity-btn" data-id="${item.id}">+</button>
                <button class="remove-item" data-id="${item.id}">Eliminar</button>
            </div>
        `;
        
        cartItemsContainer.appendChild(cartItem);
    });
    
    // Agregar event listeners a los botones de cantidad y eliminación
    const quantityBtns = cartItemsContainer.querySelectorAll('.quantity-btn');
    const removeBtns = cartItemsContainer.querySelectorAll('.remove-item');
    
    quantityBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.getAttribute('data-id'));
            const isIncrement = btn.textContent === '+';
            
            updateCartItemQuantity(id, isIncrement);
        });
    });
    
    removeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.getAttribute('data-id'));
            removeFromCart(id);
        });
    });
}

// Actualizar cantidad de un item en el carrito
function updateCartItemQuantity(id, isIncrement) {
    const item = cart.find(item => item.id === id);
    
    if (item) {
        if (isIncrement) {
            item.quantity += 1;
        } else if (item.quantity > 1) {
            item.quantity -= 1;
        } else {
            removeFromCart(id);
            return;
        }
        
        updateCartUI();
        saveCartToLocalStorage();
    }
}

// Eliminar item del carrito
function removeFromCart(id) {
    cart = cart.filter(item => item.id !== id);
    updateCartUI();
    saveCartToLocalStorage();
}

// Guardar carrito en localStorage
function saveCartToLocalStorage() {
    localStorage.setItem('coffeeStoreCart', JSON.stringify(cart));
}

// Cargar carrito desde localStorage
function loadCartFromLocalStorage() {
    const savedCart = localStorage.getItem('coffeeStoreCart');
    
    if (savedCart) {
        cart = JSON.parse(savedCart);
    }
}
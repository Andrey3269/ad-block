(function () {
    'use strict';

    console.log('Anti-CUB Premium Plugin Loaded');

    // 1. Скрываем окно стилями (чтобы оно вообще не мелькало на экране)
    var style = document.createElement('style');
    style.innerHTML = `
        .cub-premium, 
        .modal--cub,
        .cub-notice,
        .ad-block {
            display: none !important;
            opacity: 0 !important;
            visibility: hidden !important;
            pointer-events: none !important;
        }
    `;
    document.head.appendChild(style);

    // 2. Агрессивно ищем окно в фоне и "нажимаем" кнопку закрытия, 
    // чтобы разблокировать запуск плеера (таймер сбросится).
    setInterval(function() {
        var premiumBox = document.querySelector('.cub-premium, .modal--cub, .cub-notice');
        
        if (premiumBox) {
            // Ищем кнопку закрытия или любой активный элемент внутри
            var closeBtn = premiumBox.querySelector('.selector, .close, .modal__close, .cancel');
            
            if (closeBtn) {
                // Имитируем клик
                closeBtn.click();
            } else {
                // Если кнопки нет (или она заблокирована таймером), просто вырезаем узел из DOM
                premiumBox.remove();
            }
        }
    }, 500); // Проверка каждые полсекунды
})();
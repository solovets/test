class ReelsPlayer {
    constructor() {
        this.container = document.getElementById('video-container');
        this.videoTemplate = document.getElementById('video-template').content;
        this.messageContainerTemplate = document.getElementById('messageContainerTemplate').content;
        this.lastSlideContentTemplate = document.getElementById('lastSlideContentTemplate').content;
        
        // UI элементы
        this.pageIndicator = document.getElementById('pageIndicator');
        
        // Состояние
        this.videos = [];
        this.currentIndex = 0;
        this.isLoading = false;
        this.hasMore = true;
        this.isInitialized = false;
        
        // Параметры пагинации
        this.currentPage = 1;
        this.pageSize = 10;
        this.loadNextPageThreshold = 8;
        
        // Кэш страниц
        this.pageCache = new Map();
        
        // Конфигурация
        this.apiUrl = 'http://localhost:3000/feed';
        this.videoBaseUrl = 'http://localhost:3000';
        
        // Флаг для предотвращения циклических обновлений
        this.isUpdating = false;
        
        // Для отслеживания попытки скролла за пределы
        this.scrollAttempt = false;
        this.lastScrollTop = 0;
        this.scrollDirection = null;
        
        this.init();
    }

    isEmptyObject(obj) {
        for (const prop in obj) {
            if (Object.hasOwn(obj, prop)) return false;
        }
        return true;
    }

    resetToBeginning() {
        if (this.videos.length > 0 && this.currentIndex !== 0) {
            this.currentIndex = 0;
            this.updateVisibleVideos();
            
            setTimeout(() => {
                this.container.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
            }, 100);
            
            this.updatePlayback();
            this.updatePageIndicator();
        }
    }

    updatePositions() {
        // Обновляем позиции всех видео
        const videos = this.container.querySelectorAll('.video-wrapper');
        videos.forEach(wrapper => {
            const index = parseInt(wrapper.dataset.index);
            wrapper.style.transform = `translateY(${index * 100}vh)`;
        });
    }

    updateVisibleVideos() {
        if (this.isUpdating) return;
        this.isUpdating = true;
        
        console.log(`Обновляем набор видимых видео для индекса ${this.currentIndex}'`);
        
        // Сохраняем позицию скролла
        const scrollPosition = this.currentIndex * window.innerHeight;
        
        // Удаляем все существующие видео
        const existingVideos = this.container.querySelectorAll('.video-wrapper');
        existingVideos.forEach(v => v.remove());
        
        // Определяем индексы для отображения
        const indicesToShow = [];
        
        // Предыдущее видео
        if (this.currentIndex > 0) {
            indicesToShow.push(this.currentIndex - 1);
        }
        
        // Текущее видео
        indicesToShow.push(this.currentIndex);
        
        // Следующее видео
        if (this.currentIndex < this.videos.length - 1) {
            indicesToShow.push(this.currentIndex + 1);
        }
        
        console.log(`Отображаемые индексы: ${indicesToShow}`);
        
        // Создаем видео для каждого индекса
        indicesToShow.forEach(index => {
            const wrapper = this.createVideoWrapper(this.videos[index], index);
            this.container.appendChild(wrapper);
        });
        
        // Обновляем позиции
        this.updatePositions();
        
        // Восстанавливаем позицию скролла
        this.container.scrollTop = scrollPosition;
        
        console.log('Отображаемые индексы обновлены');
        this.isUpdating = false;
    }

    async init() {
        if (this.isInitialized) return;

        try {
            const page1Videos = await this.loadPage(1);
            
            if (page1Videos && page1Videos.length > 0) {
                // Показываем первые видео
                this.updateVisibleVideos();
                
                // Настраиваем обработчик скролла
                this.setupScrollObserver();
                
                this.isInitialized = true;
                this.updatePageIndicator();
                this.updatePlayback();
            } else {
                this.showMessage({
                    message: 'Нет видео для отображения',
                    isError: true,
                    position: 'center',
                    remove: 3000
                });
            }
        } catch (error) {
            console.error('Ошибка инициализации:', error);
            this.showMessage({
                message: 'Ошибка загрузки видео',
                isError: true,
                position: 'center',
                remove: 3000
            });
        }
    }

    async loadPage(page) {
        if (this.isLoading) return [];
        
        if (this.pageCache.has(page)) {
            return this.pageCache.get(page);
        }
        
        this.isLoading = true;
        const loadingMoreContainerId = this.showMessage({
            message: `Загрузка страницы ${page}...`,
            isError: false,
            position: 'bottom',
            remove: 0
        });
        
        try {
            const url = new URL(this.apiUrl);
            url.searchParams.append('page', page);
            
            const response = await fetch(url.toString(), {
                headers: { 'Accept': 'application/json' }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!Array.isArray(data)) {
                return [];
            }
            
            console.log(`Страница ${page} загружена: ${data.length} видео`);
            let processedVideos = [];
            
            if (data.length === 0) {
                this.hasMore = false;
                this.showMessage({
                    message: 'Больше видео нет',
                    isError: true,
                    position: 'bottom',
                    remove: 2000
                });
                processedVideos.push({});
            }
            
            processedVideos = data.map(video => ({
                ...video,
                fullUrl: this.normalizeUrl(video.url)
            }));
            
            this.pageCache.set(page, processedVideos);
            this.hasMore = data.length === this.pageSize;
            if (this.hasMore === false) {
                processedVideos.push({});
            }
            this.currentPage = page;
            
            // Добавляем видео в массив
            this.videos = [...this.videos, ...processedVideos];
            
            // Обновляем видимые видео
            this.updateVisibleVideos();
            
            return processedVideos;
            
        } catch (error) {
            console.error(`Ошибка загрузки страницы ${page}:`, error);
            this.showMessage({
                message: 'Ошибка загрузки',
                isError: true,
                position: 'bottom',
                remove: 2000
            });
            return [];
        } finally {
            this.isLoading = false;
            const messageContainer = document.getElementById(loadingMoreContainerId);
            if (messageContainer) {
                setTimeout(() => messageContainer.remove(), 500);
            }
        }
    }

    async loadNextPage() {
        if (!this.hasMore || this.isLoading) return;
        
        console.log(`Загрузка следующей страницы, текущая страница ${this.currentPage}`);
        
        const nextPage = this.currentPage + 1;
        await this.loadPage(nextPage);
    }

    normalizeUrl(url) {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        if (url.startsWith('/')) return this.videoBaseUrl + url;
        return url;
    }

    createLastSlide(wrapper) {
        wrapper.innerHTML = '';
        wrapper.classList.add('video-wrapper--last');
        const lastSlideContent = this.lastSlideContentTemplate.cloneNode(true).firstElementChild;
        wrapper.append(lastSlideContent);
        return wrapper;
    }

    createVideoWrapper(videoData, index) {
        const wrapper = this.videoTemplate.cloneNode(true).firstElementChild;
        wrapper.dataset.index = index;

        if (this.isEmptyObject(videoData)) {
            return this.createLastSlide(wrapper);
        }
        
        const video = wrapper.querySelector('video');
        video.src = videoData.fullUrl;
        video.loop = true;
        video.playsInline = true;
        video.preload = 'auto';
        // Включаем звук по умолчанию
        video.muted = false;
        wrapper.classList.remove('muted');
        
        wrapper.querySelector('.author').textContent = videoData.author || 'unknown';
        wrapper.querySelector('.description').textContent = videoData.description || '';
        wrapper.querySelector('.tags').textContent = videoData.tags || '';
        
        video.addEventListener('loadeddata', () => {
            wrapper.classList.remove('loading');
        });
        
        video.addEventListener('error', () => {
            wrapper.classList.add('error');
            wrapper.classList.remove('loading');
        });
        
        const playButton = wrapper.querySelector('.play-button');
        playButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePlayPause(wrapper);
        });
        
        wrapper.addEventListener('click', (e) => {
            if (!e.target.closest('.play-button')) {
                this.togglePlayPause(wrapper);
            }
        });

        const muteButton = wrapper.querySelector('.mute-indicator');
        muteButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleMute(wrapper);
        });
        
        return wrapper;
    }

    setupScrollObserver() {
        let scrollTimeout;
        let lastScrollTop = 0;
        let lastIndex = this.currentIndex;
        let scrollAttemptCount = 0;
        
        this.container.addEventListener('scroll', () => {
            if (this.isUpdating) return;
            
            const scrollTop = this.container.scrollTop;
            const clientHeight = this.container.clientHeight;
            const maxScroll = (this.videos.length - 1) * clientHeight;
            
            // Определяем направление скролла
            const direction = scrollTop > lastScrollTop ? 'down' : 'up';
            lastScrollTop = scrollTop;
            
            // Вычисляем новый индекс на основе позиции скролла
            const newIndex = Math.round(scrollTop / clientHeight);
            
            if (newIndex !== this.currentIndex) {
                console.log(`Скролл от индекса ${this.currentIndex} к индексу ${newIndex}. Всего видео: ${this.videos.length}`);
                
                lastIndex = this.currentIndex;
                this.currentIndex = newIndex;
                
                this.updateVisibleVideos();
                this.updatePlayback();
                this.updatePageIndicator();
                
                // Скрываем тост при навигации
                scrollAttemptCount = 0;
                
                // Проверяем, нужно ли загрузить следующую страницу
                if (this.currentIndex >= this.loadNextPageThreshold && this.hasMore && !this.isLoading && this.currentIndex < this.videos.length) {
                    this.loadNextPage();
                }
            } else {
                // Индекс не изменился
                
                // Проверяем, находимся ли мы на последнем видео
                if (this.currentIndex === this.videos.length - 1 && !this.hasMore) {
                    
                    // Проверяем, пытается ли пользователь скроллить вниз (за пределы)
                    if (direction === 'down' && scrollTop > maxScroll - 10) {
                        scrollAttemptCount++;
                    }
                }
            }
            
            clearTimeout(scrollTimeout);
        });
    }

    updatePlayback() {
        const videos = this.container.querySelectorAll('video');
        
        videos.forEach(video => {
            const wrapper = video.closest('.video-wrapper');
            if (!wrapper) return;
            const index = parseInt(wrapper.dataset.index);
            
            if (index === this.currentIndex) {
                this.playVideo(video);
            } else {
                this.pauseVideo(video);
            }
        });
    }

    playVideo(videoElement) {
        if (!videoElement) return;
        
        const playPromise = videoElement.play();
        
        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    const wrapper = videoElement.closest('.video-wrapper');
                    if (wrapper) {
                        wrapper.classList.remove('paused');
                    }
                })
                .catch(error => {
                    console.log(`Ошибка воспроизведения (политика автовоспроизведения): ${error}`);
                    // Если не получается воспроизвести со звуком, пробуем без звука
                    if (!videoElement.muted) {
                        videoElement.muted = true;
                        const wrapper = videoElement.closest('.video-wrapper');
                        if (wrapper) {
                            wrapper.classList.add('muted');
                        }
                        videoElement.play().catch(e => console.log(`Ошибка воспроизведения без звука: ${e}`));
                    }
                });
        }
    }

    pauseVideo(videoElement) {
        if (!videoElement) return;
        
        videoElement.pause();
        const wrapper = videoElement.closest('.video-wrapper');
        if (wrapper) {
            wrapper.classList.add('paused');
        }
    }

    togglePlayPause(wrapper) {
        const video = wrapper.querySelector('video');
        if (!video) return;
        
        if (video.paused) {
            this.playVideo(video);
        } else {
            this.pauseVideo(video);
        }
    }

    toggleMute(wrapper) {
        const video = wrapper.querySelector('video');
        const button = wrapper.querySelector('.mute-indicator');
        
        if (!video) return;
        
        video.muted = !video.muted;
        button.classList.toggle('mute-indicator--muted', video.muted);
        
        this.showMessage({
            message: video.muted ? 'Звук выключен' : 'Звук включен',
            isError: false,
            position: 'center',
            remove: 1500
        });
    }

    updatePageIndicator() {
        if (!this.pageIndicator) return;
        
        const currentPage = Math.floor(this.currentIndex / this.pageSize) + 1;
        const totalPages = Math.ceil(this.videos.length / this.pageSize);
        this.pageIndicator.textContent = `Страница ${currentPage} из ${totalPages}`;
    }

    showMessage({
        message,
        isError = false,
        position = 'center',
        remove = 2000
    }) {
        if (this.messageContainerTemplate) {
            const randomId = `id${Math.random().toString(36).substring(2, 8)}`;
            const clone = this.messageContainerTemplate.cloneNode(true).firstElementChild;
            clone.innerHTML = message;
            clone.classList.add(`message-container--${!!isError ? 'error' : 'info'}`);
            clone.classList.add(`message-container--${position}`);
            clone.setAttribute('id', randomId);
            document.body.appendChild(clone);

            if (remove !== 0) {
                setTimeout(() => {
                    const messageContainer = document.getElementById(randomId);
                    if (messageContainer) messageContainer.remove();
                }, remove);
            } else {
                return randomId;
            }
        }
         
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.player = new ReelsPlayer();
});
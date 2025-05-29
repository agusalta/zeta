const Zeta = (() => {
    // --- Configuración y helpers ---
    const helpers = {}
    const config = { requirePrefix: false }

    // --- Estado reactivo con Proxy mejorado ---
    let state = {}
    let bindings = {}
    let isInitialized = false

    // Cache para expresiones evaluadas y dependencias
    const exprCache = new Map()
    const depsCache = new Map()

    // Contexto de evaluación reutilizable
    let evalContext = {}

    const updateEvalContext = () => {
        evalContext = Object.assign(Object.create(null), helpers, state)
    }

    // --- API Principal ---
    const core = {
        // Configuración
        config(opts = {}) {
            if (typeof opts.requirePrefix === 'boolean') {
                config.requirePrefix = opts.requirePrefix
            }
            return this
        },

        // Inicializa estado reactivo
        init(obj = {}) {
            Object.assign(state, obj)

            state = new Proxy(state, {
                set: (target, prop, value) => {
                    const oldValue = target[prop]
                    target[prop] = value

                    // Solo disparar si el valor cambió realmente
                    if (oldValue !== value) {
                        updateEvalContext()
                        // Ejecutar bindings de esta propiedad
                        if (bindings[prop]) {
                            bindings[prop].forEach(fn => {
                                try {
                                    fn(value, oldValue)
                                } catch (err) {
                                    console.error(`Error en binding para "${prop}":`, err)
                                }
                            })
                        }
                    }
                    return true
                }
            })

            updateEvalContext()
            isInitialized = true
            return this
        },

        // Registra helpers
        helper(name, fn) {
            helpers[name] = fn
            updateEvalContext()
            return this
        },

        // Getter/setter estilo hook
        zeta(key) {
            return (val) => {
                if (val === undefined) return state[key]
                state[key] = val
            }
        },

        // Watch mejorado - ahora funciona correctamente
        watch(keyOrKeys, fn) {
            const keys = keyOrKeys.split(',').map(k => k.trim())
            keys.forEach(key => {
                if (!state.hasOwnProperty(key)) {
                    console.warn(`Zeta.watch: clave "${key}" no existe en state`)
                }
                this._bind(key, fn)
            })
            return this
        },

        // Estado derivado mejorado
        derive(key, computeFn) {
            const deps = this._extractDeps(computeFn)
            const update = () => {
                try {
                    const newValue = computeFn.call(evalContext)
                    if (state[key] !== newValue) {
                        state[key] = newValue
                    }
                } catch (err) {
                    console.error(`Error en derive para "${key}":`, err)
                }
            }

            deps.forEach(dep => this._bind(dep, update))
            update() // Calcular valor inicial
            return this
        },

        // Escaneo del DOM optimizado
        scan() {
            if (!isInitialized) {
                console.warn('Zeta: Debes llamar init() antes de scan()')
                return this
            }

            updateEvalContext()

            // Procesar directivas individuales primero
            this._processDirective('z\\:init', (el, expr) => this._executeCode(expr))
            this._processDirective('z\\:click', (el, expr) => {
                // Evitar múltiples listeners
                if (el._zetaClick) return
                el._zetaClick = true
                el.addEventListener('click', () => {
                    this._executeCode(expr)
                })
            })
            this._processDirective('z\\:text', (el, expr) => this._bindText(el, expr))
            this._processDirective('z\\:model', (el, key) => this._bindModel(el, key))
            this._processDirective('z\\:watch', (el, expr) => this._bindWatch(el, expr))
            this._processDirective('z\\:fade', (el, expr) => this._bindFade(el, expr))
            this._processDirective('z\\:if', (el, expr) => this._bindIf(el, expr))
            this._processDirective('z\\:each', (el, arg) => this._bindEach(el, arg)) // Asegúrate de procesar z:each aquí también

            // Procesar directivas unificadas z=""
            this._processUnifiedDirectives()

            // Iniciar intersection observer para fade
            this._initIntersectionObserver()

            return this
        },

        // --- Métodos internos optimizados ---

        _processDirective(selector, handler) {
            document.querySelectorAll(`[${selector}]`).forEach(el => {
                const expr = el.getAttribute(selector.replace('\\:', ':'))
                if (expr) handler(el, expr.trim())
            })
        },

        _processUnifiedDirectives() {
            document.querySelectorAll('[z]').forEach(el => {
                const commands = el.getAttribute('z')
                    .split(';')
                    .map(cmd => cmd.trim())
                    .filter(Boolean)

                commands.forEach(cmd => {
                    const colonIndex = cmd.indexOf(':')
                    if (colonIndex === -1) return

                    const type = cmd.slice(0, colonIndex).trim()
                    const arg = cmd.slice(colonIndex + 1).trim()

                    this._handleUnifiedDirective(el, type, arg)
                })
            })
        },

        _handleUnifiedDirective(el, type, arg) {
            switch (type) {
                case 'click':
                    if (!el._zetaClick) {
                        el._zetaClick = true
                        el.addEventListener('click', () => {
                            this._executeCode(arg)
                        })
                    }
                    break
                case 'text':
                    this._bindText(el, arg)
                    break
                case 'model':
                    this._bindModel(el, arg)
                    break
                case 'init':
                    this._executeCode(arg)
                    break
                case 'if':
                    this._bindIf(el, arg)
                    break
                case 'show':
                    this._bindShow(el, arg)
                    break
                case 'class':
                    this._bindClass(el, arg)
                    break
                case 'style':
                    this._bindStyle(el, arg)
                    break
                case 'each':
                    this._bindEach(el, arg)
                    break
                case 'watch':
                    this._bindWatch(el, arg)
                    break
            }
        },

        _bindText(el, expr) {
            const update = () => {
                try {
                    const result = this._evaluateExpression(expr)
                    const newText = result == null ? '' : String(result)
                    if (el.textContent !== newText) {
                        el.textContent = newText
                    }
                } catch (err) {
                    console.error('Error en z:text:', err)
                    el.textContent = ''
                }
            }

            update()
            this._bindToDeps(expr, update)
        },

        _bindModel(el, key) {
            // Sincronizar valor inicial
            if (state.hasOwnProperty(key)) {
                el.value = state[key] || ''
            }

            // Escuchar cambios del estado
            this._bind(key, (value) => {
                if (el.value !== String(value || '')) {
                    el.value = value || ''
                }
            })

            // Escuchar cambios del input
            if (!el._zetaModel) {
                el._zetaModel = true
                const updateState = () => {
                    const value = el.type === 'checkbox' ? el.checked : el.value
                    if (state[key] !== value) {
                        state[key] = value
                        updateEvalContext() // Actualizar el contexto después de cambiar el estado
                    }
                }

                el.addEventListener('input', updateState)
                el.addEventListener('change', updateState)
            }
        },

        _bindWatch(el, expr) {
            // z:watch ahora funciona correctamente
            const update = () => {
                try {
                    // Evaluar expresión para disparar dependencias
                    this._evaluateExpression(expr)

                    // Trigger personalizado si existe
                    if (el.hasAttribute('z:watch-trigger')) {
                        const trigger = el.getAttribute('z:watch-trigger')
                        this._executeCode(trigger)
                    }

                    // Re-scan elementos hijos si tienen directivas
                    el.querySelectorAll('[z\\:text], [z\\:show], [z\\:if], [z\\:class], [z\\:style]').forEach(child => {
                        // Forzar actualización de directivas hijas
                        child.dispatchEvent(new CustomEvent('zeta-update'))
                    })
                } catch (err) {
                    console.error('Error en z:watch:', err)
                }
            }

            this._bindToDeps(expr, update)
        },

        _bindShow(el, expr) {
            const update = () => {
                try {
                    const show = Boolean(this._evaluateExpression(expr))
                    el.style.display = show ? '' : 'none'
                } catch (err) {
                    console.error('Error en z:show:', err)
                }
            }

            update()
            this._bindToDeps(expr, update)
        },

        _bindIf(el, expr) {
            const parent = el.parentNode
            const placeholder = document.createComment('z:if')
            let isVisible = false

            const update = () => {
                try {
                    const show = Boolean(this._evaluateExpression(expr))

                    if (show && !isVisible) {
                        parent.replaceChild(el, placeholder)
                        isVisible = true
                    } else if (!show && isVisible) {
                        parent.replaceChild(placeholder, el)
                        isVisible = false
                    }
                } catch (err) {
                    console.error('Error en z:if:', err)
                }
            }

            update()
            this._bindToDeps(expr, update)
        },

        _bindClass(el, arg) {
            const rules = arg.split(',').map(rule => {
                const [classes, condition] = rule.split(':').map(s => s.trim());
                return {
                    classes: classes.split(' ').filter(c => c), // Separar y filtrar clases vacías
                    condition
                };
            });

            const update = () => {
                rules.forEach(({ classes, condition }) => {
                    try {
                        const shouldHave = Boolean(this._evaluateExpression(condition));
                        classes.forEach(className => {
                            if (className) {
                                el.classList.toggle(className, shouldHave);
                            }
                        });
                    } catch (err) {
                        console.error(`Error en z:class para "${classes.join(' ')}":`, err);
                    }
                });
            };

            update();
            rules.forEach(({ condition }) => this._bindToDeps(condition, update));
        },

        _bindStyle(el, arg) {
            const rules = arg.split(',').map(rule => {
                const colonIndex = rule.indexOf(':')
                const property = rule.slice(0, colonIndex).trim()
                const expression = rule.slice(colonIndex + 1).trim()
                return { property, expression }
            })

            const update = () => {
                rules.forEach(({ property, expression }) => {
                    try {
                        const value = this._evaluateExpression(expression)
                        el.style[property] = value || ''
                    } catch (err) {
                        console.error(`Error en z:style para "${property}":`, err)
                    }
                })
            }

            update()
            rules.forEach(({ expression }) => this._bindToDeps(expression, update))
        },

        _bindEach(el, arg) {
            const match = arg.match(/(.+?)\s+in\s+(.+)/)
            if (!match) {
                console.error('z:each formato incorrecto. Use: "item in array"')
                return
            }

            const [, itemName, arrayExpr] = match
            const parent = el.parentNode

            // Obtener el contenido del template si es un elemento <template>
            const templateContent = el.content ? el.content : el;
            const originalTemplateNode = el;
            const placeholder = document.createComment('z:each')

            parent.replaceChild(placeholder, originalTemplateNode)

            const update = () => {
                try {
                    const array = this._evaluateExpression(arrayExpr.trim())

                    // Limpiar elementos anteriores generados por este z:each
                    let nodeToClear = placeholder.nextSibling;
                    while (nodeToClear && nodeToClear.nodeType !== Node.COMMENT_NODE && nodeToClear.dataset && nodeToClear.dataset.zetaEach === itemName.trim()) {
                        const nextNode = nodeToClear.nextSibling;
                        nodeToClear.remove();
                        nodeToClear = nextNode;
                    }
                    // Si el template contiene múltiples nodos raíz, el dataset.zetaEach
                    // debería aplicarse a cada uno. Por simplicidad, un enfoque más amplio de limpieza:
                    nodeToClear = placeholder.nextSibling;
                    while (nodeToClear && nodeToClear !== placeholder && nodeToClear.nodeType !== Node.COMMENT_NODE) {
                        const nextNode = nodeToClear.nextSibling;
                        nodeToClear.remove();
                        nodeToClear = nextNode;
                    }


                    // Crear nuevos elementos
                    if (Array.isArray(array)) {
                        array.forEach((item, index) => {
                            // Clonar el contenido real del template
                            const clone = templateContent.cloneNode(true);

                            // Si el clone es un DocumentFragment, aplicar dataset a sus hijos
                            if (clone.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
                                Array.from(clone.children).forEach(child => {
                                    child.dataset.zetaEach = itemName.trim(); // Marca los elementos para futura limpieza
                                });
                            } else if (clone.nodeType === Node.ELEMENT_NODE) {
                                clone.dataset.zetaEach = itemName.trim();
                            }

                            // Procesar el template clonado con los datos del item
                            this._processTemplate(clone, itemName.trim(), item, index);

                            parent.insertBefore(clone, placeholder.nextSibling);
                        });
                    }
                } catch (err) {
                    console.error('Error en z:each:', err)
                }
            }

            update()
            this._bindToDeps(arrayExpr, update)
        },

        _processTemplate(element, itemName, item, index) {
            // Si el elemento es un DocumentFragment, el TreeWalker debe iniciarse desde él.
            const root = element.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? element : element;

            const walker = document.createTreeWalker(
                root,
                NodeFilter.SHOW_TEXT,
                null,
                false
            )

            let textNode
            while (textNode = walker.nextNode()) {
                // Usar nodeValue para modificar el contenido del nodo de texto
                textNode.nodeValue = textNode.nodeValue
                    .replace(new RegExp(`{{${itemName}}}`, 'g'), item)
                    .replace(new RegExp(`{{${itemName}Index}}`, 'g'), index)
            }
        },

        _bindFade(el, expr) {
            el.classList.add('zeta-fade')
            // El intersection observer manejará la visibilidad
        },

        _bindToDeps(expr, callback) {
            const deps = this._extractDeps(expr)
            deps.forEach(dep => this._bind(dep, callback))
        },

        _bind(key, fn) {
            if (!bindings[key]) bindings[key] = []
            bindings[key].push(fn)
        },

        _executeCode(code) {
            try {
                // Manejar operaciones de incremento/decremento
                if (code.includes('++') || code.includes('--')) {
                    const [varName, op] = code.split(/(\+\+|\-\-)/);
                    const currentValue = this._evaluateExpression(varName.trim());
                    const newValue = op === '++' ? currentValue + 1 : currentValue - 1;
                    state[varName.trim()] = newValue;
                    return newValue;
                }

                // Manejar asignaciones simples (variable = valor)
                if (code.includes('=')) {
                    const [varName, valueExpr] = code.split('=').map(s => s.trim());
                    const newValue = this._evaluateExpression(valueExpr); // Evaluar el valor de la expresión
                    state[varName] = newValue;
                    return newValue;
                }

                return new Function('with(this){' + code + '}').call(evalContext)
            } catch (err) {
                console.error('Error ejecutando código:', err)
                return null
            }
        },

        _evaluateExpression(expr) {
            // Cache para expresiones frecuentes
            if (exprCache.has(expr)) {
                const fn = exprCache.get(expr)
                return fn.call(evalContext)
            }

            try {
                const fn = new Function('with(this){return(' + expr + ')}')
                exprCache.set(expr, fn)
                return fn.call(evalContext)
            } catch (err) {
                console.error('Error evaluando expresión:', expr, err)
                return null
            }
        },

        _extractDeps(exprOrFn) {
            const expr = typeof exprOrFn === 'function' ? exprOrFn.toString() : exprOrFn

            if (depsCache.has(expr)) {
                return depsCache.get(expr)
            }

            // Regex mejorada para capturar variables
            const matches = expr.match(/\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g) || []
            const deps = [...new Set(matches)]
                .filter(word =>
                    state.hasOwnProperty(word) &&
                    !['true', 'false', 'null', 'undefined', 'this'].includes(word)
                )

            depsCache.set(expr, deps)
            return deps
        },

        _initIntersectionObserver() {
            if (typeof IntersectionObserver === 'undefined') return;

            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    const el = entry.target;
                    const fadeAttr = el.getAttribute('z:fade') || el.getAttribute('z');
                    const isOnce = fadeAttr && fadeAttr.includes('once');

                    if (entry.isIntersecting) {
                        el.classList.add('zeta-visible');
                    } else if (!isOnce) {
                        // Solo remover la clase si no es 'once'
                        el.classList.remove('zeta-visible');
                    }
                });
            }, {
                threshold: 0.1,
                rootMargin: '50px' // Agregar un margen para que el efecto comience un poco antes
            });

            document.querySelectorAll('[z\\:fade], [z*="fade:"]').forEach(el => {
                observer.observe(el);
            });
        },

        // Utilidades públicas
        get state() { return state },
        get bindings() { return bindings },

        // Método para limpiar cache (útil para desarrollo)
        clearCache() {
            exprCache.clear()
            depsCache.clear()
            return this
        }
    }

    // Exponer globalmente
    window.Zeta = core
    return core
})()

// CSS por defecto para fade
if (!document.querySelector('#zeta-styles')) {
    const styles = document.createElement('style')
    styles.id = 'zeta-styles'
    styles.textContent = `
        .zeta-fade {
            opacity: 0;
            transform: translateY(20px);
            transition: opacity 0.6s ease, transform 0.6s ease;
        }
        .zeta-fade.zeta-visible {
            opacity: 1;
            transform: translateY(0);
        }
    `
    document.head.appendChild(styles)
}
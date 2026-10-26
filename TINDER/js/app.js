const DECISION_THRESHOLD = 75
const ROTATION_DIVISOR = 14
const LABEL_FULL_OPACITY_DISTANCE = 100

const PROFILES = [
  {
    name: 'Mateo',
    age: 28,
    photo: 'images/photos/1.png',
    alt: 'Mateo, hombre con barba y lentes, camisa blanca, 28 años'
  },
  {
    name: 'Daniel',
    age: 30,
    photo: 'images/photos/2.png',
    alt: 'Daniel, hombre con chaqueta verde, de cuerpo completo, 30 años'
  },
  {
    name: 'Laura',
    age: 26,
    photo: 'images/photos/3.png',
    alt: 'Laura, mujer pelirroja tomándose una selfie con un amigo, 26 años'
  },
  {
    name: 'Andrés',
    age: 29,
    photo: 'images/photos/4.png',
    alt: 'Andrés, hombre sonriente con camisa verde frente a una pared roja, 29 años'
  },
  {
    name: 'Sebastián',
    age: 24,
    photo: 'images/photos/5.png',
    alt: 'Sebastián, grupo de amigos riendo en una selfie, 24 años'
  }
]

const swipedHistory = []
let isAnimating = false

function createCard(profile) {
  const card = document.createElement('article')

  card.innerHTML = `
    <img src="${profile.photo}" alt="${profile.alt}" draggable="false" />
    <h2>${profile.name} <span>${profile.age}</span></h2>
    <div class="choice nope">NOPE</div>
    <div class="choice like">LIKE</div>
  `

  return card
}

function renderCards(container, profiles) {
  profiles
    .slice()
    .reverse()
    .forEach((profile) => container.appendChild(createCard(profile)))
}

function getCardsContainer() {
  return document.getElementById('cards')
}

function getTopCard() {
  const cards = getCardsContainer().querySelectorAll('article')
  return cards.length ? cards[cards.length - 1] : null
}

function registerSwipe(card, direction) {
  card.remove()
  swipedHistory.push({ card, direction })
}

function swipeTopCard(direction) {
  if (isAnimating) return

  const card = getTopCard()
  if (!card) return

  isAnimating = true

  if (direction === 'right') card.querySelector('.choice.like').style.opacity = 1
  if (direction === 'left') card.querySelector('.choice.nope').style.opacity = 1

  card.addEventListener(
    'transitionend',
    () => {
      registerSwipe(card, direction)
      isAnimating = false
    },
    { once: true }
  )

  card.classList.add(`go-${direction}`)
}

function undoLastSwipe() {
  if (isAnimating || swipedHistory.length === 0) return

  const { card, direction } = swipedHistory.pop()
  isAnimating = true

  card.removeAttribute('style')
  card.querySelectorAll('.choice').forEach((label) => label.removeAttribute('style'))

  card.classList.add(`go-${direction}`, 'no-transition')
  getCardsContainer().appendChild(card)

  void card.offsetWidth

  card.addEventListener(
    'transitionend',
    () => {
      isAnimating = false
    },
    { once: true }
  )

  card.classList.remove(`go-${direction}`, 'no-transition')
}

function getPointerX(event) {
  return event.pageX ?? event.touches[0].pageX
}

function startDrag(event) {
  if (isAnimating) return

  const card = event.target.closest('.cards article')
  if (!card) return

  const startX = getPointerX(event)
  let pullDeltaX = 0

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onEnd)
  document.addEventListener('touchmove', onMove, { passive: true })
  document.addEventListener('touchend', onEnd, { passive: true })

  function onMove(moveEvent) {
    pullDeltaX = getPointerX(moveEvent) - startX
    isAnimating = true

    const rotation = pullDeltaX / ROTATION_DIVISOR

    card.style.transform = `translateX(${pullDeltaX}px) rotate(${rotation}deg)`
    card.style.cursor = 'grabbing'

    const isRight = pullDeltaX > 0
    const label = card.querySelector(isRight ? '.choice.like' : '.choice.nope')

    label.style.opacity = Math.abs(pullDeltaX) / LABEL_FULL_OPACITY_DISTANCE
  }

  function onEnd() {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onEnd)
    document.removeEventListener('touchmove', onMove)
    document.removeEventListener('touchend', onEnd)

    card.querySelectorAll('.choice').forEach((label) => {
      label.style.opacity = 0
    })

    if (pullDeltaX === 0) {
      card.removeAttribute('style')
      isAnimating = false
      return
    }

    const decisionMade = Math.abs(pullDeltaX) >= DECISION_THRESHOLD
    let direction = null

    if (decisionMade) {
      direction = pullDeltaX > 0 ? 'right' : 'left'
      card.classList.add(`go-${direction}`)
    } else {
      card.classList.add('reset')
    }

    card.addEventListener(
      'transitionend',
      () => {
        if (decisionMade) {
          registerSwipe(card, direction)
        } else {
          card.removeAttribute('style')
          card.classList.remove('reset')
        }

        isAnimating = false
      },
      { once: true }
    )
  }
}

function initDrag() {
  document.addEventListener('mousedown', startDrag)
  document.addEventListener('touchstart', startDrag, { passive: true })
}

function boostProfile() {
  const logo = document.querySelector('header img')

  logo.classList.remove('boosting')
  void logo.offsetWidth
  logo.classList.add('boosting')
}

const BUTTON_ACTIONS = [
  { selector: 'button.is-undo',   action: () => undoLastSwipe() },
  { selector: 'button.is-remove', action: () => swipeTopCard('left') },
  { selector: 'button.is-star',   action: () => swipeTopCard('up') },
  { selector: 'button.is-fav',    action: () => swipeTopCard('right') },
  { selector: 'button.is-zap',    action: () => boostProfile() }
]

function initButtons() {
  BUTTON_ACTIONS.forEach(({ selector, action }) => {
    const button = document.querySelector(selector)
    if (button) button.addEventListener('click', action)
  })
}

function init() {
  renderCards(getCardsContainer(), PROFILES)
  initDrag()
  initButtons()
}

init()

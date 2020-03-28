// We try to detect the lang, fallback to french
var lang = (navigator.language && navigator.language.slice(0, 2)) || 'fr';

let tweetCssClasses = null
let articles = []
let lock = false

// Fetch 20 random page ids on the wikipedia API
async function reloadRandomPages() {
  try {
    const response = await fetch(`https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*&list=random&rnnamespace=0&rnfilterredir=nonredirects&rnlimit=20`, {mode: 'cors'})
    const data = await response.json()
    const articles_ids = data.query.random.map((a) => a.id)    
    const pages = await Promise.all(articles_ids.map(async function (id) {
      p = await getPage(id)
      return p
    }))
    return pages
  } catch (error) {
    return []
  }
}

// Fetch a specific page on the wikipedia API
async function getPage(id) {
  try {
    const page_response = await fetch(`https://${lang}.wikipedia.org//w/api.php?action=query&format=json&origin=*&prop=extracts%7Cpageimages%7Cinfo&pageids=${id}&redirects=1&exsentences=4&exlimit=max&exintro=1&explaintext=1&piprop=original&pilimit=1`, { mode: 'cors' })
    const pages_data = await page_response.json()
    const unfiltered = Object.values(pages_data.query.pages)

    // We don't want "too small" pages
    if (unfiltered[0].length < 2000) {
      return null
    }
    return unfiltered[0]
  } catch (error) {
    return []
  }
}

// Fetch articles and enqueue them in our currently available ones
async function fetchAndQueue() {
  const rnpages = await reloadRandomPages()
  const npages = rnpages && rnpages.filter(e => e !== null)
  if (npages && npages.length > 0) {
    Array.prototype.push.apply(articles, npages)
  }
  return true
}

// Take an article from our saved articles list, fetch new ones if empty
async function getArticle() {
  const article = articles.pop()
  if (article === undefined) {    
    await fetchAndQueue()
    return await getArticle()
  }
  if (article.original &&
      article.original.source &&
      (!article.original.source.match(/Defaut\.svg|manquante/)) &&
      article.extract) {
    return article
  } else {
    return await getArticle()
  }
}

// Keep the classnames of the tweet
const grabClasses = () => {
  let tweets = document.querySelectorAll("div[aria-label^='timeline' i] article[role='article'] > div > div > div:nth-child(2) div[lang]");
  tweetCssClasses = tweets[0].classList.toString()
}

// Replace COVID-19 tweet by a random wikipedia article
const replaceTweet = (t, article) => {
  t.parentElement.querySelector('div:nth-child(1)').innerHTML = ''
  const titleElt = t.querySelector('div:nth-child(2) > div:nth-child(2) > div:nth-child(1)')
  const textElt = t.querySelector('div:nth-child(2) > div:nth-child(2) > div:nth-child(2)')
  const imgElt = t.querySelector('div:nth-child(2) > div:nth-child(1) div')
  titleElt.innerHTML = ``
  textElt.innerHTML = `<div class="${tweetCssClasses}"><div><a style="color: inherit;margin-top: 10px;display: block;text-decoration: none;" href="https://${lang}.wikipedia.org/wiki/${article.title}" target="_blank" rel="noopener"><b>${article.title}</b></a></div><p style="margin-top: 3px;">${article.extract}</p><img style="padding-top: 5px;max-width: 100%;max-height: 300px; border-radius: 10px;border: 1px solid transparent;" src="${article.original.source}" alt=""/></div>`
  imgElt.innerHTML = `<img style="padding-top: 5px; max-width: 100%" src="https://fr.wikipedia.org/static/images/project-logos/frwiki-2x.png" alt=""/>`
}

// Replace all the COVID tweets in the current DOM
const replaceTweets = async () => {
  if (document.readyState != 'interactive') {
    let tweets = document.querySelectorAll("div[aria-label^='timeline' i] article[role='article'] > div > div > div:nth-child(2)");
    if (tweetCssClasses === null) {
      grabClasses()
    }
    if (tweets.length === 0) {
      return
    }
    
    tweets.forEach(async function(t) {
      if (t.textContent.match(/epid[eé]mi|coronavirus|covid|confin[eé]|quarantin/i)) {
        const article = await getArticle()
        if (article) {
          replaceTweet(t, article)
          t.parentElement.parentElement.parentElement.attributes.removeNamedItem('role')
        }
      } else {
        t.parentElement.parentElement.parentElement.attributes.removeNamedItem('role')
      }
    })
  }
}

const fillQueue = async () => {
  if (lock) {
    return
  }

  try {
    lock = true
    
    if (articles.length < 50) {
      await fetchAndQueue()
    }
    await replaceTweets()
    lock = false
  } catch (error) {
    console.error(error)
    lock = false
  }
}

// Watch and replace tweets every second
(async function () {
  articles = await reloadRandomPages(50)
  setInterval(async () => {
    await fillQueue()
  }, 1000)
})();

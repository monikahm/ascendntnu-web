var express = require('express')
var app = express()
var cors = require('cors')
var fs = require('fs')
var mkdirp = require('mkdirp')
var yamljs = require('yamljs')
var fm = require('front-matter')
var commonmark = require('commonmark')
var reader = new commonmark.Parser()
var writer = new commonmark.HtmlRenderer()

var dotenv = require('dotenv')
dotenv.config()

if (fileExists('.env.local')) {
  Object.assign(process.env, dotenv.parse(fs.readFileSync('.env.local')))
}

var constants = {
  access: process.env.ACCESS || '',
  pathToCV: process.env.PATH_TO_CV || './cv',
}

if (process.env.NODE_ENV !== 'production') {
  app.use(cors())
}

app.use('/images', express.static(__dirname + '/build/images'))
app.use('/public/assets', express.static(__dirname + '/build/images/assets'))
app.use(
  '/publications',
  express.static(__dirname + '/build/images/assets/publications')
)
app.use('/blog/rss', express.static(__dirname + '/api/v1/blog.rss'))
app.use('/sitemap.xml', express.static(__dirname + '/api/v1/sitemap.xml'))
app.use('/node_modules', express.static(__dirname + '/node_modules'))

var port = process.env.SERVER_PORT || 80
var listener = app.listen(port, function () {
  console.log('Listening on http://localhost:' + listener.address().port)
})

app.get('/api/v1', function(req, res) {
  res.sendFile(__dirname + '/api/v1/index.html')
})

app.get('/api/v1/posts', function(req, res) {
  var files = fs
    .readdirSync('./posts')
    .filter(file => /\.md$|\.markdown$/.test(file))
    .map(slugify)

  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.send(JSON.stringify(files, null, 2))
})

function slugify(fileName) {
  return (
    fileName
      .toLowerCase()
      //.replace(/^[0-9]{2,4}-[0-9]{1,2}-[0-9]{1,2}-/, '')
      .replace(/\.md$|\.markdown$/, '')
  )
}

function rmMdLinks(str) {
  return str.replace(/\]\([^\)]*\)/g, ']').replace(/!?\[([^\]]*)\]/g, '$1')
}

function pascalCase(str) {
  return str
    .split(' ')
    .map(word => word.slice(0, 1).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function digits(value, places) {
  places = typeof places === 'number' ? places : 2
  return (Array(places).join('0') + value).slice(-places)
}

app.get('/api/v1/posts/all', function(req, res) {
  var files = fs
    .readdirSync('./posts')
    .filter(file => /\.md$|\.markdown$/.test(file))
    .map(postName => {
      var pathToPost = __dirname + '/posts/' + postName
      var element = {}
      if (fileExists(pathToPost)) element = fm(fs.readFileSync(pathToPost) + '')
      element['file'] = postName
      element['link'] = slugify(postName)
      return element
    })

  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.send(JSON.stringify(files, null, 2))
})

app.get('/api/v1/cv/:key?/:file?', function(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')

  var public = !req.params.key || req.params.key === 'public'
  var error = null

  if (!public && constants.access.indexOf(req.params.key) === -1) {
    error = 'Key do not match any'
    public = true
  }

  if (
    req.params.file &&
    /[a-z\-øæå]--[a-zøæå0-9]+--\d\d?--[a-z]+\.[a-z0-9]+$/.test(
      req.params.file.toLowerCase()
    )
  ) {
    var find = req.params.file.split(/\./)[0].replace(/[^a-zøæå0-9\-]+/gi, '')
    var re = public ? new RegExp('--pub--' + find) : new RegExp(find)
    var files = fs.readdirSync(constants.pathToCV).filter(file => re.test(file))

    if (files.length) {
      var info = files[0].split(/--|\./)
      var newName = `${info[2]}--${info[3]}--${info[4]}--${info[5]}.${
        info[info.length - 1]
      }`
      res.download(
        __dirname + '/' + constants.pathToCV + '/' + files[0],
        newName
      )
    } else {
      res.send('Could not find file.')
    }

    return false
  }

  if (constants.pathToCV) {
    var re = public
      ? /^\d+--pub--[a-z\-øæå]+--[a-zøæå0-9]+--\d\d?--[a-z]+--/
      : /^\d+--p[ubriv]+--[a-z\-øæå]+--[a-zøæå0-9]+--\d\d?--[a-z]+--/
    var files = fs
      .readdirSync(constants.pathToCV)
      .filter(file => re.test(file.toLowerCase()))
      .map(postName => {
        var info = postName.split(/--|\./)
        var date = new Date(parseInt(info[0]))
        var dateFormatted = `${date.getFullYear()}-${digits(
          date.getMonth()
        )}-${digits(date.getDate())} ${digits(date.getHours())}:${digits(
          date.getMinutes()
        )}:${digits(date.getSeconds())}`
        var name = info[2].split('-')
        var description =
          fs
            .readdirSync(constants.pathToCV)
            .filter(f =>
              new RegExp(`description--${info[6]}[a-z0-9\-]*.txt`).test(f)
            )
            .map(descFile => {
              return fs.readFileSync(
                constants.pathToCV + '/' + descFile,
                'utf-8'
              )
            }) + ''
        var cv = `${info[2]}--${info[3]}--${info[4]}--${info[5]}.${
          info[info.length - 1]
        }`

        return {
          date: dateFormatted,
          first_name: pascalCase(name.shift()),
          last_name: pascalCase(name.pop()),
          middle_name: pascalCase(name ? name.join(' ') : ''),
          study: info[3].toUpperCase(),
          year: parseInt(info[4]),
          group: info[5].toLowerCase(),
          description: description,
          cv: cv,
        }
      })

    res.send(JSON.stringify({ students: files, error: error }, null, 2))
  } else {
    res.send('Backend issue. No path to CV specified.')
  }
})

app.get('/api/v1/posts/:post', function(req, res) {
  var postName = req.params.post
  var files = fs
    .readdirSync('./posts')
    .filter(file => new RegExp(postName, 'i').test(file))
  var pathToPost = __dirname + '/posts/' + (files[0] || '')

  res.setHeader('Content-Type', 'application/json; charset=utf-8')

  if (fileExists(pathToPost) && files.length) {
    var postData = fm(fs.readFileSync(pathToPost) + '')
    postData['file'] = files[0]
    postData['link'] = slugify(files[0])
    res.send(JSON.stringify(postData, null, 2))
  } else res.send('Could not find post.')
})

app.get('/api/v1/:section', function(req, res) {
  var section = req.params.section
  var validSection = /^[a-z]+$/.test(section)

  var fileName = __dirname + '/api/v1/' + section + '.json'

  if (validSection && fileExists(fileName)) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.sendFile(fileName)
  } else res.sendFile(__dirname + '/api/v1/index.html')
})

app.get('/api/v1/:section/:year', function(req, res) {
  var year = req.params.year
  var validYear = /^20[0-9]{2}$/.test(year)

  var section = req.params.section
  var validSection = /^[a-z]+$/.test(section)

  var fileName = __dirname + '/api/v1/' + year + '/' + section + '.json'

  if (validSection && validYear && fileExists(fileName)) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.sendFile(fileName)
  } else res.sendFile(__dirname + '/api/v1/index.html')
})

var years = [2016, 2017, 2018]
var groups = {
  history: {},
  sponsors: {},
  members: {},
}

var data = []
var fileName = ''
var dirName = ''
var dataFormatted = ''

years.forEach(year => {
  dirName = 'api/v1/' + year

  for (var group in groups) {
    data = []
    fileName = 'data/' + group + '.' + year + '.yml'

    if (fileExists(fileName)) data = yamljs.load(fileName)

    dataFormatted = JSON.stringify(data, null, 2)
    mkdirp.sync(dirName)
    fs.writeFile(dirName + '/' + group + '.json', dataFormatted, err => {
      if (err) throw err
    })

    groups[group][year] = data
  }
})

dirName = 'api/v1'

for (var group in groups) {
  dataFormatted = JSON.stringify(groups[group], null, 2)
  fs.writeFile(dirName + '/' + group + '.json', dataFormatted, err => {
    if (err) throw err
  })
}

function fileExists(filePath) {
  try {
    var exists = fs.statSync(filePath)
    return true
  } catch (err) {
    return false
  }
}

// AMP articles, which can be read from Google in mobile view.
app.get('/blog/amp/:post', function(req, res) {
  var post = req.params.post

  var files = fs
    .readdirSync('./posts')
    .filter(file => new RegExp(post, 'i').test(file))
  var pathToPost = __dirname + '/posts/' + (files[0] || '')

  if (fileExists(pathToPost) && files.length) {
    var postData = fm(fs.readFileSync(pathToPost) + '')
    postData.link = slugify(files[0])

    res.send(createAmpArticle(postData))
  } else {
    res.sendFile(__dirname + '/build/index.html')
  }
})

// Facebook Instant article support.
app.get('/blog/fb/:post', function(req, res) {
  var post = req.params.post

  var files = fs
    .readdirSync('./posts')
    .filter(file => new RegExp(post, 'i').test(file))
  var pathToPost = __dirname + '/posts/' + (files[0] || '')

  if (fileExists(pathToPost) && files.length) {
    var postData = fm(fs.readFileSync(pathToPost) + '')
    postData.link = slugify(files[0])

    res.send(createFBInstantArticle(postData))
  } else {
    res.sendFile(__dirname + '/build/index.html')
  }
})

// Create Facebook Instant Articles RSS feed.
var articles = []
fs.readdirSync('./posts').forEach(file => {
  var post = fm(fs.readFileSync(__dirname + '/posts/' + file) + '')
  var content = writer.render(reader.parse(post.body))

  articles.push({
    authors: post.attributes.author.split(/\s*[,&]\s*/),
    content: content,
    date: post.attributes.date.toISOString(),
    description: rmMdLinks(post.body.split(/\n/)[0]),
    link: slugify(file),
    title: post.attributes.title,
  })
})

fs.writeFile('api/v1/blog.rss', createRSSFeed(articles), err => {
  if (err) throw err
})

// Also generating a sitemap for Google to watch.
var articleLinks = articles.map(article => article.link)
fs.writeFile('api/v1/sitemap.xml', createSitemap(articleLinks), err => {
  if (err) throw err
})

app.get('/blog/:post', function(req, res) {
  var post = req.params.post

  var files = fs
    .readdirSync('./posts')
    .filter(file => new RegExp(post, 'i').test(file))
  var pathToPost = __dirname + '/posts/' + (files[0] || '')

  if (fileExists(pathToPost) && files.length) {
    var postData = fm(fs.readFileSync(pathToPost) + '')
    var link = slugify(files[0])
    var title = postData.attributes.title
    var d = postData.attributes.date
    var date = `${d.getFullYear()}-${digits(d.getMonth())}-${digits(
      d.getDate()
    )} ${digits(d.getHours())}:${digits(d.getMinutes())}:${digits(
      d.getSeconds()
    )}`
    var image = 'https://ascendntnu.no/images/logo/logo.png'
    if (postData.attributes.image) {
      if (/^http/.test(postData.attributes.image))
        image = postData.attributes.image
      else image = 'https://ascendntnu.no' + postData.attributes.image
    }
    var desc = rmMdLinks(postData.body.split(/\n/)[0])
    var tags = postData.attributes.categories.split(/[,\s]+/)
    var authors = postData.attributes.author.split(/\s*[,&]\s*/)

    res.send(
      prerender(req, {
        title: title,
        desc: desc,
        date: date,
        image: image,
        metatags:
          `\n    <link rel="amphtml" href="https://ascendntnu.no/blog/amp/${link}" />` +
          tags
            .map(
              tag => `\n    <meta property="article:tag" content="${tag}" />`
            )
            .join('\n    ') +
          `<meta property="og:url" content="https://ascendntnu.no/blog/${link}" />`,
        // + authors.map(author => `\n    <meta property="article:author" content="${author}" />`).join('\n    ')
      })
    )
  } else {
    res.sendFile(__dirname + '/build/index.html')
  }
})

app.use('/', express.static(__dirname + '/build'))

app.get('/*', function(req, res) {
  var pieces = req.originalUrl.split(/\//)
  switch (pieces[1]) {
    case 'blog':
      res.send(
        prerender(req, {
          title: 'Blog',
          desc:
            'Read the Ascend NTNU blog and get the newest updates from the group.',
        })
      )
      break
    case 'drones':
      res.send(
        prerender(req, {
          title: 'Drones',
          desc:
            'Ascend NTNU makes a new drone every year. Here you can view them all.',
        })
      )
      break
    case 'join':
      res.send(
        prerender(req, {
          title: 'Join',
          desc:
            'Want to join our team? Send a mail or sign up for upcoming opportunities.',
        })
      )
      break
    case 'sponsors':
      res.send(
        prerender(req, {
          title: 'Sponsors',
          desc:
            'This is the sponsor page. If you want to support Ascend NTNU we are happy to have you as sponsors.',
        })
      )
      break
    case 'about':
      res.send(
        prerender(req, {
          title: 'About',
        })
      )
      break
    case 'missions':
      res.send(
        prerender(req, {
          title: 'Missions',
          desc:
            'Our main purpose is to solve a mission which was created in 2014. It may be impossble to solve it today, but as tech grows we may be able to solve the mission tomorrow.',
        })
      )
      break
    case 'team':
      res.send(
        prerender(req, {
          title: 'Team',
          desc:
            'Our team has 28 members divided into 5 main groups. You can read more about the groups here...',
        })
      )
      break
    case 'contact':
      res.send(
        prerender(req, {
          title: 'Contact',
          desc:
            'Want to contact us? Feel free to send us a mail and we will contact you back.',
        })
      )
      break
  }

  res.sendFile(__dirname + '/build/index.html')
})

function prerender(req, data) {
  data.title = data.title || 'Home'
  data.desc =
    data.desc ||
    `Autonomus aerial robotics. Ascend NTNU is The Norwegian University of Science and Technology's team in the International Aerial Robotics Competition (IARC).`
  data.image = data.image || '/images/logo/logo.png'
  data.link =
    data.link || req.protocol + '://' + req.get('host') + req.originalUrl
  data.date = data.date || ''
  data.metatags = data.metatags || ''

  return `<!doctype html>
<html>
  <head>
    <title>Ascend NTNU - ${data.title}</title>
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
    <meta name="description" content="${data.desc}" />
    <meta name="keywords" content="Ascend, NTNU, robotics, autonomus, team, IARC, international, aerial, robotics, competition, AI" />
    <meta name="author" content="Ascend NTNU" />
    <meta property="fb:app_id" content="202744680073731" />
    <meta property="fb:pages" content="1666025910343164" />
    ${
      data.date
        ? `<meta property="${
            data.metatags ? 'article:published_time' : 'og:date'
          }" content="${data.date}" />`
        : ''
    }
    <meta property="og:type" content="article" />
    <meta property="og:image" content="${data.image}" />
    <meta property="og:title" content="Ascend NTNU - ${data.title}" />
    <meta property="og:description" content="${data.desc}" />
    <meta name="google-site-verification" content="8BRTGtX6p1hMedISBUbbwoyCQKG-yAi_lfQwP6ZG0PU" />${
      data.metatags
    }
    <link rel="alternate" hreflang="en" href="https://ascendntnu.no" />
    <link rel="alternate" hreflang="no" href="https://ascendntnu.no" />
    <link rel="alternate" type="application/rss+xml" title="Ascend NTNU RSS" href="https://ascendntnu.no/blog/rss">
    <link rel="shortcut icon" href="/images/logo/logo.png" />
    <link rel="apple-touch-icon" href="/images/logo/ascend-logo-social.jpg" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.6.3/css/font-awesome.min.css" />
    <link rel="stylesheet" href="/node_modules/katex/dist/katex.min.css" />
    <link rel="stylesheet" href="/static/css/main.css" />
    <script defer src="/static/js/main.js"></script>
    <script type="application/ld+json">
    {
      "@context": "http://schema.org/",
      "@type": "Organization",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "Trondheim, Norway",
        "postalCode": "7034",
        "streetAddress": "O.S. Bragstads plass 2 A/B"
      },
      "description": "${data.desc}",
      "email": "hi(at)ascendntnu.no",
      "foundingLocation": {
      	"@type": "Place",
        "geo": {
          "@type": "GeoCoordinates",
          "latitude": 63.4183894,
          "longitude": 10.401931
        }
      },
      "foundingDate": "2015-07-28",
      "image": "${
        /^http/.test(data.image)
          ? data.image
          : 'https://ascendntnu.no' + data.image
      }",
      "logo": "https://ascendntnu.no/images/logo/logo.png",
      "name": "Ascend NTNU",
      "memberOf": {
        "@type": "Organization",
        "name": "NTNU",
        "url": "https://ntnu.no"
      },
      "sameAs": [
        "https://twitter.com/ascendntnu",
        "https://instagram.com/ascendntnu",
        "https://www.facebook.com/ascendntnu",
        "https://www.youtube.com/channel/UC_9brAjG9aLLhhQTw2vU0qQ",
        "https://www.linkedin.com/company/ascend-ntnu"
      ],
      "sponsor": {
        "@type": "Organization",
        "name": "Kongsberg",
        "image": "https://kongsberg.com/images/kog2017/kongsberg-logo.png",
        "url": "https://kongsberg.com/"
      },
      "url": "https://ascendntnu.no"
    }
    </script>
    <!-- Global site tag (gtag.js) - Google Analytics -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=UA-113307510-1"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'UA-113307510-1');
    </script>
  </head>
  <body>
    <div id="app" class="app-container"></div>
    <div id="fb-root"></div>
    <script>
    (function(d, s, id) {
      var js, fjs = d.getElementsByTagName(s)[0];
      if (d.getElementById(id)) return;
      js = d.createElement(s); js.id = id;
      js.src = "//connect.facebook.net/nb_NO/sdk.js#xfbml=1&version=v2.8&appId=202744680073731";
      fjs.parentNode.insertBefore(js, fjs);
    }(document, "script", "facebook-jssdk"));
    </script>
  </body>
</html>`
}

function createAmpArticle(data) {
  data.title = data.title || 'Home'
  data.desc =
    data.desc ||
    `Autonomus aerial robotics. Ascend NTNU is The Norwegian University of Science and Technology's team in the International Aerial Robotics Competition (IARC).`
  data.image = data.image || '/images/logo/logo.png'
  data.link = data.link || ''
  var parsed = reader.parse(data.body)
  var result = writer.render(parsed)
  result = result
    .replace(/<img /g, '<amp-img width="640" height="480" layout="responsive" ')
    .replace(/<\/img>/g, '</amp-img>')
    .replace(/<video /g, '<amp-video ')
    .replace(/<\/video>/g, '</amp-video>')
    .replace(/<iframe /g, '<amp-iframe ')
    .replace(/<\/iframe>/g, '</amp-iframe>')
  var iframe = /amp-iframe/.test(result)

  return `<!doctype html>
<html amp lang="en">
  <head>
    <meta charset="utf-8">
    <script async src="https://cdn.ampproject.org/v0.js"></script>
    <title>${data.attributes.title}</title>
    <link rel="canonical" href="https://ascendntnu.no/blog/${data.link}" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Open+Sans|Questrial|Roboto+Slab" />
    <meta name="viewport" content="width=device-width,minimum-scale=1,initial-scale=1">
    <script async custom-element="amp-social-share" src="https://cdn.ampproject.org/v0/amp-social-share-0.1.js"></script>
    ${
      iframe
        ? '<script async custom-element="amp-iframe" src="https://cdn.ampproject.org/v0/amp-iframe-0.1.js"></script>'
        : ''
    }
    <script type="application/ld+json">
      {
        "@context": "http://schema.org",
        "@type": "BlogPosting",
        "about": "${rmMdLinks(data.body.split(/\n/)[0])}",
        "articleBody": "${result}",
        "author": {
          "@type": "Person",
          "name": "${data.attributes.author.split(/\s*[,&]\s*/).join(', ') ||
            'Ascend NTNU'}"
        },
        "dateCreated": "${data.attributes.date.toISOString()}",
        "datePublished": "${data.attributes.date.toISOString()}",
        "genre": "technology",
        "headline": "${data.attributes.title}",
        "image": [
          "${data.attributes.image || '/images/ascend-logo-social.jpg'}"
        ],
        "thumbnailUrl": "${data.attributes.image ||
          '/images/ascend-logo-social.jpg'}"
      }
    </script>
    <style amp-boilerplate>body{-webkit-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-moz-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-ms-animation:-amp-start 8s steps(1,end) 0s 1 normal both;animation:-amp-start 8s steps(1,end) 0s 1 normal both}@-webkit-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-moz-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-ms-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-o-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}</style><noscript><style amp-boilerplate>body{-webkit-animation:none;-moz-animation:none;-ms-animation:none;animation:none}</style></noscript>
    <style amp-custom>
      body {
        font-family: 'Open Sans', sans-serif;
        background-color: #444;
        color: #ddd;
      }
      article {
        padding: 16px;
        margin: auto;
        max-width: 720px;
      }
      a {
        color: #f80;
        cursor: pointer;
        text-decoration: none;
        border-bottom: 1px dashed #f80;
      }
      .img-float-right + img, .img-float-right + figure {
        float: right;
        margin: 8px 0 16px 16px;
      }
      .img-float-left + img, .img-float-left + figure {
        float: left;
        margin: 8px 16px 16px 0;
      }
      img, iframe {
        display: block;
        margin: auto;
        clear: both;
      }
      img {
        max-width: 100%;
        max-height: 240px;
      }
    </style>
  </head>
  <body>
    <article>
    <h1>${data.attributes.title}</h1>
    <amp-social-share type="facebook" data-param-url="https://ascendntnu.no/blog/${
      data.link
    }" data-param-app_id="202744680073731"></amp-social-share>
    <amp-social-share type="twitter" data-param-url="https://ascendntnu.no/blog/${
      data.link
    }"></amp-social-share>
    <amp-social-share type="linkedin" data-param-url="https://ascendntnu.no/blog/${
      data.link
    }"> </amp-social-share>
    <amp-social-share type="email" data-param-url="https://ascendntnu.no/blog/${
      data.link
    }"></amp-social-share>
    ${result}
    </article>
  </body>
</html>`
}

function texToAscii(tex) {
  return tex
    .replace(/\^\{([^\}]*)\}/g, '<sup>$1</sup>')
    .replace(/_\{([^\}]*)\}/g, '<sub>$1</sub>')
    .replace(/\\vec\{([^\}]*)\}/g, ' &#x20d7;$1')
    .replace(/\\bot/g, '⅂')
    .replace(/\\updownarrow/gi, '&#x21d5;')
}

function createFBInstantArticle(data) {
  data.title = data.title || 'Home'
  data.desc =
    data.desc ||
    `Autonomus aerial robotics. Ascend NTNU is The Norwegian University of Science and Technology's team in the International Aerial Robotics Competition (IARC).`
  data.image = 'https://ascendntnu.no' + (data.image || '/images/logo/logo.png')
  data.attributes.image =
    'https://ascendntnu.no' + (data.attributes.image || '/images/logo/logo.png')
  data.link = data.link || ''
  var related = data.attributes.related
    ? data.attributes.related
        .split(/\s*,\s*|\s+/)
        .map(r => (/^\d/.test(r) ? 'https://ascendntnu.no/blog/' + r : r))
    : []
  var date = data.attributes.date.toISOString()
  var ingress = rmMdLinks(data.body.split(/\n/)[0])
  var parsed = reader.parse(data.body.split(/^[^\n]+\n/)[1])
  var result = writer
    .render(parsed)
    .replace(/<p><img ([^>]*)\><\/p>/g, '<figure><img $1></figure>')
    .replace(/<(\/?)h[3-6]>/g, '<$1h2>')
    .replace(/\s&\s/g, ' and ')
    .replace(/\shref=(['"])\/([a-z])/g, ' href=$1https://ascendntnu.no/$2')
    .replace(/\ssrc=(['"])\/([a-z])/g, ' src=$1https://ascendntnu.no/$2')
    .replace(/<figure/g, '<figure data-feedback="fb:none"')

  reTex = /<tex([^>]*)>([^<]*)<\/tex>/g
  var texSplit = result.split(/<tex|<\/tex>/g)
  var newResult = ''

  for (var i = 0; i < texSplit.length - 1; i += 2) {
    var parts = texSplit[i + 1].split('>')
    var meta = parts[0]
    var tex = parts[1]
    newResult += texSplit[i] + `<span${meta}>${texToAscii(tex)}</span>`
  }

  result = newResult + texSplit[texSplit.length - 1]

  return `<!doctype html>
<html lang="en" prefix="op: http://media.facebook.com/op#">
  <head>
    <meta charset="utf-8">
    <title>${data.attributes.title}</title>
    <link rel="canonical" href="https://ascendntnu.no/blog/${data.link}" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Open+Sans|Questrial|Roboto+Slab" />
    <meta property="op:markup_version" content="v1.0">
    <meta property="fb:article_style" content="Ascend Dark Theme">
    <script type="application/ld+json">
      {
        "@context": "http://schema.org",
        "@type": "BlogPosting",
        "about": "${ingress}",
        "author": {
          "@type": "Person",
          "name": "${data.attributes.author.split(/\s*[,&]\s*/).join(', ') ||
            'Ascend NTNU'}"
        },
        "dateCreated": "${date}",
        "datePublished": "${date}",
        "genre": "technology",
        "headline": "${data.attributes.title}",
        "image": [
          "${data.attributes.image || '/images/ascend-logo-social.jpg'}"
        ],
        "thumbnailUrl": "${data.attributes.image ||
          '/images/ascend-logo-social.jpg'}"
      }
    </script>
  </head>
  <body>
    <article>
      <header>
        <h1>${data.attributes.title}</h1>
        <h2>${ingress}</h2>
        <time class="op-published" datetime="${
          data.attributes.date
        }">${date}</time>
        <address>
          <a>${data.attributes.author.split(/\s*&\s*/).join(' &#038; ')}</a>
          From Ascend NTNU.
        </address>
        <figure>
          <img src="${data.attributes.image}" />
          <figcaption>${data.attributes.title}</figcaption>
        </figure>  
      </header>
      ${result}
      <footer>${related + '' &&
        '\n        <ul class="op-related-articles">' +
          related
            .map(r => `\n          <li><a href="${r}"></a></li>`)
            .join('') +
          '\n        </ul>'}
        <small>© Ascend NTNU ${new Date().getFullYear()}</small>
      </footer>
    </article>
  </body>
</html>`
}

function createRSSFeed(articles) {
  var articlesFormatted = articles.reverse().map(item => {
    var authors = item.authors.map(author => `<author>${author}</author>`)

    return `<item>
      <title>${item.title}</title>
      <link>ascendntnu.no/blog/${item.link}</link>
      <content:encoded>
        <![CDATA[${item.content}]]>
      </content:encoded>
      <guid>${item.link}</guid>
      <description>${item.description}</description>
      <pubDate>${new Date(item.date).toISOString()}</pubDate>
      ${authors.join('\n      ')}
    </item>`
  })

  return `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <title>Ascend NTNU Blog</title>
    <link>https://ascendntnu.no/</link>
    <description>Our latest tech articles</description>
    ${articlesFormatted.join('\n    ')}
  </channel>
</rss>`
}

function createSitemap(articles) {
  var articlesFormatted = articles.map(item => {
    return `<url><priority>0.85</priority><loc>https://ascendntnu.no/blog/${slugify(
      item
    )}</loc><changefreq>monthly</changefreq></url>`
  })

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
  <url><priority>1.00</priority><loc>https://ascendntnu.no/</loc><changefreq>weekly</changefreq><lastmod>${new Date().toISOString()}</lastmod></url>
  <url><priority>0.90</priority><loc>https://ascendntnu.no/about</loc><changefreq>weekly</changefreq></url>
  <url><priority>0.90</priority><loc>https://ascendntnu.no/join</loc><changefreq>weekly</changefreq></url>
  <url><priority>0.90</priority><loc>https://ascendntnu.no/team</loc><changefreq>monthly</changefreq></url>
  <url><priority>0.90</priority><loc>https://ascendntnu.no/contact</loc><changefreq>weekly</changefreq></url>
  <url><priority>0.90</priority><loc>https://ascendntnu.no/blog</loc><changefreq>weekly</changefreq></url>
  <url><priority>0.90</priority><loc>https://ascendntnu.no/blog/rss</loc><changefreq>weekly</changefreq></url>
  ${articlesFormatted.join('\n  ')}
  <url><priority>0.80</priority><loc>https://ascendntnu.no/drones</loc><changefreq>yearly</changefreq></url>
  <url><priority>0.80</priority><loc>https://ascendntnu.no/missions</loc><changefreq>yearly</changefreq></url>
  <url><priority>0.70</priority><loc>https://ascendntnu.no/sponsors</loc><changefreq>yearly</changefreq></url>
</urlset>`
}

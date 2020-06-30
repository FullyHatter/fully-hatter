const fs = require('fs')
const mustache = require('mustache')
const { JST } = require('node-utils')
const BasePage = require('./base_page')
const rooting = require('../../static/rooting')
const mongodbDriver = require('../mongodb_driver')

const template = fs.readFileSync('./static/template/template.mustache', 'utf8')
const homeTemplate = fs.readFileSync('./static/template/home.mustache', 'utf8')
const likeStr = { ja: 'いいね！', en: 'like' }
const commentJA = 'コメント'

module.exports = class HomePage extends BasePage {
    constructor({ element }) {
        const title = {}
        const description = {}
        if (element.ja) {
            title.ja = element.ja.title
            description.ja = element.ja.description
        }
        if (element.en) {
            title.en = element.en.title
            description.en = element.en.description
        }
        
        super({
            element,
            urlPath: element.urlPath,
            contentType: 'text/html',
            title,
            description
        })
        this.setView({ cssPath: '/css/styles-home.css' })
    }
    
    async get(lan, pageNum) {
        this.view.lan = { [lan]: true }
        this.view.title = this.title[lan]
        this.view.description = this.description[lan]
        this.view.isNew = this.element[lan].isNew
        
        const summary = await mongodbDriver.findCountsForHome(lan)
        const comments = await mongodbDriver.findComments({ urlPath: { $ne: '/temp' }, lan })
        this._updateViewHome(pageNum, summary, comments, lan)
        
        this.view.bodyHTML = mustache.render(homeTemplate, this.viewHome)
        return mustache.render(template, this.view)
    }
    
    _updateViewHome(pageNum, summary, comments, lan) {
        this.viewHome = {
            world: [],
            story: []
        }
        this.viewHome.lan = { [lan]: true }
        rooting.forEach((v) => {
            v.elements.forEach((e) => {
                if (v.styleInHome && e[lan]) {
                    this.viewHome[v.styleInHome].push({
                        urlPath: (e.numOfChapters) ? `${e.urlPath}-1` : e.urlPath,
                        picturePath: `/images${e.urlPath}.jpg`,
                        title: e[lan].title,
                        description: e[lan].description,
                        newTag: (e[lan].isNew) ? '<span class="tag is-danger">New!</span>' : ''
                    })
                }
            })
        })
        
        // add advertisement
        if (lan === 'ja') {
            this.viewHome.world.push({
                urlPath: 'http://amex.jp/share/jaSY1?CPID=100341017',
                title: '[広告] Fully Hatter愛用中の American Express クレジットカードのご紹介。このリンクから申し込むことで最大 17,000円相当のポイントを取得できます！ これがアメックスを始める最もお得な手段です。',
                advertisement: true
            })
            this.viewHome.world.push({
                urlPath: 'https://m.do.co/c/9b2bd756e7ab',
                title: '[広告] この「秘密の部屋」は DigitalOcean でホスティングしています。個人用サーバーなら AWS より DigitalOcean です。このリンクから DigitalOcean に登録した方にはもれなく $100 をプレゼント！',
                advertisement: true
            })
        }
        
        for (let i = 0; i < this.viewHome.world.length; i += 1) {
            if (!this.viewHome.world[i].advertisement) {
                const likeCount = summary.likeCount[this.viewHome.world[i].urlPath] || 0
                const commentCount = summary.commentCount[this.viewHome.world[i].urlPath] || 0
                this.viewHome.world[i].like = `${likeStr[lan]} ${likeCount}`
                this.viewHome.world[i].comment = `${commentJA} ${commentCount}`
            }
            
            if (i === 0) {
                this.viewHome.world[i].headHTML = '<div class="column">'
            }
            if (i === Math.floor((this.viewHome.world.length - 1) / 2)) {
                this.viewHome.world[i].footHTML = '</div>'
                this.viewHome.world[i].footHTML += '<div class="column">'
            }
            if (i === this.viewHome.world.length - 1) {
                this.viewHome.world[i].footHTML = '</div>'
            }
        }
        
        for (let i = 0; i < this.viewHome.story.length; i += 1) {
            const likeCount = summary.likeCount[this.viewHome.story[i].urlPath] || 0
            this.viewHome.story[i].like = `${likeStr[lan]} ${likeCount}`
            
            if (i === 0) {
                this.viewHome.story[i].headHTML = '<div class="column">'
            }
            if (i === Math.floor((this.viewHome.story.length - 1) / 2)) {
                this.viewHome.story[i].footHTML = '</div>'
                this.viewHome.story[i].footHTML += '<div class="column">'
            }
            if (i === this.viewHome.story.length - 1) {
                this.viewHome.story[i].footHTML = '</div>'
            }
        }
        
        // create comment list
        const pageTotal = Math.ceil(comments.length / 5)
        let pageNumValidated
        
        if (pageTotal === 0) {
            pageNumValidated = 0
        } else if (pageNum >= 1 && pageNum <= pageTotal) {
            pageNumValidated = pageNum
        } else {
            pageNumValidated = 1
        }
        
        this.viewHome.commentListPagination = {
            pageNum: pageNumValidated,
            pageTotal,
            previousPageNum: (pageNumValidated <= 1) ? 1 : pageNumValidated - 1,
            disabledPrevious: (pageNumValidated <= 1) ? 'disabled' : '',
            nextPageNum: (pageNumValidated >= pageTotal) ? pageTotal : pageNumValidated + 1,
            disabledNext: (pageNumValidated >= pageTotal) ? 'disabled' : ''
        }
        
        // from latest to oldest
        comments.sort((obj1, obj2) => obj2.date.getTime() - obj1.date.getTime())
        
        const commentListView = []
        comments.slice(pageNumValidated * 5 - 5, pageNumValidated * 5).forEach((commentObj) => {
            const viewObj = this.viewHome.world.find((e) => e.urlPath === commentObj.urlPath)
            const commentStr = mustache.render('{{raw}}', { raw: commentObj.comment }).replace(/(\r\n|\n|\r)/gm, ' ')
            
            let urlPath
            let pageTitle
            if (lan === 'ja') {
                urlPath = commentObj.urlPath
                pageTitle = (viewObj) ? viewObj.title : '掲示板'
            } else if (lan === 'en') {
                urlPath = `/en${commentObj.urlPath}`
                pageTitle = (viewObj) ? viewObj.title : 'Board'
            }
            commentListView.push({
                date: JST.convertToDate(commentObj.date),
                urlPath,
                pageTitle,
                name: commentObj.name,
                excerptOfComment: (commentStr.length > 30) ? `${commentStr.slice(0, 30)}...` : commentStr
            })
        })
        this.viewHome.comments = commentListView
    }
}

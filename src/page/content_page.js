const fs = require('fs')
const BasePage = require('./base_page')

module.exports = class ContentPage extends BasePage {
    constructor({ element, filePath }) {
        let contentType
        if (filePath.ja.match(/\.png$/)) {
            contentType = 'image/png'
        } else if (filePath.ja.match(/\.jpg$/)) {
            contentType = 'image/jpeg'
        } else if (filePath.ja.match(/\.js$/)) {
            contentType = 'text/javascript'
        }
        
        super({ element, contentType })
        this.content = fs.readFileSync(filePath.ja)
    }

    async get() {
        return this.content
    }
}
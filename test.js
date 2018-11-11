'use strict'
const pug = require('pug');
const assert = require('assert');

//pugのテンプレートにおけるXSS脆弱性のテスト
const html = pug.renderFile('./views/posts.pug',{
  posts:[{
    id:1,
    content:' a',
    postedBy:'guest1',
    trackingCookie: '2639292283224063_ddcc625203464a9e10af58fc3eb92eed7df4b9b5',
    createdAt: new Date(),
    updatedAt: new Date()
 }],
 user:'guest1'
});

//スクリプトタグがエスケープされて含まれていることをチェック
assert(html.indexOf(' ') > 0);
console.log('テストがかんりょうしました');
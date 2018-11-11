'use strict';
const crypto = require('crypto');
const pug = require('pug');
const Cookies = require('cookies'); 
const moment = require('moment-timezone');
const util = require('./handler-util');
const Post = require('./post');
const trackingIdKey = 'tracking_id'

const oneTimeTokenMap = new Map();

function handle(req,res){
  const cookies = new Cookies(req,res);
  const trackingId = addTrackingCookie(cookies,req.user);
  switch(req.method){
    case 'GET':
     res.writeHead(200,{
        'Content-Type': 'text/html; charset=utf-8'
      });
      Post.findAll({order:[['id', 'DESC']]}).then((posts) => {
        posts.forEach(post => {
          post.content = post.content.replace(/\+/g,' ')
          post.formateCreatedAt = moment(post.createdAt).tz('Asia/Tokyo').format('YYYY年MM月DD日 HH時mm分ss秒');
        });
        const oneTimeToken = crypto.randomBytes(8).toString('hex');
        oneTimeTokenMap.set(req.user,oneTimeToken);
        res.end(pug.renderFile('./views/posts.pug',{
          posts: posts,
          user: req.user,
          oneTimeToken:oneTimeToken
        }));
        console.info(
          `-------------------------------------------------\n` +
          `[閲覧されました]:\n`+
          `user: ${req.user}\n`+ 
          `trackingId: ${trackingId}\n` + 
          `remoteAddress: ${req.connection.remoteAddress}\n` +
          `userAgent: ${req.headers['user-agent']}\n`+
          `-------------------------------------------------` 
        );
      });
      break;
    case 'POST':
      let body = [];
      req.on('data',(chunk) => {
        body.push(chunk);
      }).on('end', () => {
        body = Buffer.concat(body).toString();
        const decoded = decodeURIComponent(body);
        const dataArray = decoded.split('&');
        const content = dataArray[0]? dataArray[0].split('content=')[1]:' ';
        const requestedOneTimeToken = dataArray[1]? dataArray[1].split('oneTimeToken=')[1] : '';
        if(oneTimeTokenMap.get(req.user) === requestedOneTimeToken){
        console.info('投稿されました:' + content);
        Post.create({
          content:content,
          trackingCookie:trackingId,
          postedBy:req.user
        }).then(() => {
          oneTimeTokenMap.delete(req.user);
          handleRedirectPosts(req,res);
        })
      }else{
        util.handleBadRequest(req,res);
      }
      })
      break;
    default:
      util.handleBadRequest(req,res);
      break;
  }
}

function handleDelete(req,res){
  switch (req.method){
    case 'POST':
      let body = [];
      req.on('data', (chunk) => {
        body.push(chunk);
      }).on('end' ,() => {
        body = Buffer.concat(body).toString();
        const decoded = decodeURIComponent(body);
        const dataArray = decoded.split('&');
        const id = dataArray[0]? dataArray[0].split('id=')[1]:' ';
        const requestedOneTimeToken = dataArray[1]? dataArray[1].split('oneTimeToken=')[1] : '';
        if(oneTimeTokenMap.get(req.user) === requestedOneTimeToken){
        Post.findById(id).then((post) => {
          if(req.user === post.postedBy || req.user === 'admin'){
            post.destroy();
          }
          handleRedirectPosts(req,res);
        });
        console.info(
          `-------------------------------------------------\n` +
          `[削除されました]:\n`+
          `user: ${req.user}\n` + 
          `remoteAddress: ${req.connection.remoteAddress}\n` +
          `userAgent: ${req.headers['user-agent']}\n`+
          `-------------------------------------------------` 
        );
      }else{
        util.handleBadRequest(res,req);
      }
      });
      break;
    default:
      util.handleBadRequest(req,res);
      break;
  }
}

/**
* Cookieに含まれているトラッキングIDに異常がなければその値を返し、
* 存在しない場合や異常なものである場合には、再度作成しCookieに付与してその値を返す
* @param {Cookies} cookies
* @param {String} userName
* @return {String} トラッキングID
*/

function addTrackingCookie(cookies,userName){
  const requestedTrackingId = cookies.get(trackingIdKey);
  if(isVaildTrackingId(requestedTrackingId,userName)){
    return requestedTrackingId;
  }else{
    const originalId = parseInt(crypto.randomBytes(8).toString('hex'), 16);
    const tomorrow = new Date(new Date().getTime()+(1000*60*60*24))
    const trackingId = originalId + '_' + createValidHash(originalId,userName);
    cookies.set(trackingIdKey,trackingId,{expires:tomorrow});
    return trackingId;
  }
}

function isVaildTrackingId(trackingId,userName){
  if(!trackingId){
    return false;
  }
  const splitted = trackingId.split('_');
  const originalId = splitted[0];
  const requestedHash = splitted[1];
  return createValidHash(originalId,userName) === requestedHash;
}


const secretKey = '1c42a1b6f1a4fd0686417ae3c40025f221bd5b455bd1b77bfcb9ba7bd965f17026c756e9061a81f7d17e03a061b0206cbfce36bdeefc312bcb403e560554886a367b65237dc6b7b984ef2e346bb163189f003661864e41df313678bd2da3d0073238558a0485e14f0ca47c800454a20284308df47f1feb7067d52265ffc6682790a8a4a1d0f0e303361dd020cdbb03f892078472853f0c96abccf50d53eed86570be9fe3b93845280dfad323a622f9ffda2f64746c23ff64180bad2794e43e45082ce455a9f016a70224988b94f0f3960effa2394f831533f3241b3cbb0e9ba0df23f7066df823bd447db3293cf817992de029e38132b9fd4007469b026a4001';

function createValidHash(originalId,userName){
  const sha1sum = crypto.createHash('sha1');
  sha1sum.update(originalId + userName + secretKey);
  return sha1sum.digest('hex');
}
function handleRedirectPosts(req,res){
  res.writeHead(303,{
    'Location':'/posts'
  });
  res.end();
}

module.exports = {
  handle:handle,
  handleDelete:handleDelete
};
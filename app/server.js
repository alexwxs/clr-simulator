// call the packages we need
var express    = require('express');
var cors 	   = require('cors');
var app        = express();
var fs 		   = require('fs');
var bodyParser = require('body-parser');
var customUserId = null;
var customUserName = null;
// Debug Mode
var isDebugMode = false;

// configure app to use bodyParser()
// this will let us get the data from a POST
 app.use(bodyParser.urlencoded({ extended: true }));
 app.use(bodyParser.json());
 app.use(cors())

var port = process.env.PORT || 8197;
var router = express.Router();


router.get('/coupons', function(req, res) {
  printLogs('Request Received: ' + req.url);
  printLogs('randomCode: ' + req.query.genericCouponCode);
	var offers = JSON.parse(fs.readFileSync('./offers.json', 'utf8'));
  var offerExists = false;
  if (isDebugMode){
    printLogs('Offer server is running in Debug Mode...');
    offerExists = true;
    var newResponseDebug = JSON.parse(fs.readFileSync('./response-template-debug.json', 'utf8'));
    res.json(newResponseDebug);
  } else {
    for (var i in offers) {
      if (offers[i]["randomCode"] == req.query.genericCouponCode) {
        printLogs('offer found: ' + offers[i]["displayName"]);
        if (offers[i]["offerId"] == "999999" && offers[i]["displayName"] == "Punch Card")  {
          printLogs("This is a punch card offer");
          var newResponsePunch = JSON.parse(fs.readFileSync('./response-template-punchcard.json', 'utf8'));
          res.json(newResponsePunch);
        }
        else {
          printLogs("This is a promotion offer");
          var newResponse = JSON.parse(fs.readFileSync('./response-template.json', 'utf8'));
          var promotionXml = fs.readFileSync('./offers/' + offers[i]["randomCode"] + "-" + offers[i]["displayName"], 'utf8');
          promotionXml = promotionXml.split('\n').join('').split('\r').join('').split('\t').join('');
          printLogs('promotionXml: ' + promotionXml);
          var parseString = require('xml2js').parseString;
          parseString(promotionXml, function (err, result) { 
            printLogs('Promotion ID = ' + result["Promotion"]["$"]["id"]);
            var promotionId = result["Promotion"]["$"]["id"];
            newResponse["OfferInfo"]["OfferId"] = offers[i]["offerId"];
            newResponse["OfferInfo"]["GenericCouponCode"] = offers[i]["randomCode"];
            newResponse["OfferInfo"]["PromotionId"] = promotionId;
            newResponse["OfferInfo"]["PromotionXmlBase64"] = Buffer.from(promotionXml).toString('base64');
          });
          if (customUserId != null) {
            newResponse["CustomerInfo"]["CustomerId"] = customUserId;
          }
          if (customUserName != null) {
            newResponse["CustomerInfo"]["DisplayName"] = customUserName;
          }
          res.json(newResponse);
        }
        offerExists = true;
      }
    }
  }
  if (!offerExists){
    printLogs('ERROR: randomCode: ' + req.query.genericCouponCode + ' Not Found!');
    res.status(404).json({ 'ErrorCode': 'CouponNotFound', 'ErrorMessage': 'Could not find coupon information'});
  }
});

router.post('/offers/:customID/:offerID/redeem', function(req, res) {
	printLogs('Request Received: ' + req.url);
  var offers = JSON.parse(fs.readFileSync('./offers.json', 'utf8'));
  var offerExists = false;
	for (var i in offers) {
    if (offers[i]["offerId"] == req.params.offerID) {
      offerExists = true;
    }
	}
  if (offerExists){
    printLogs('Success: Offer found: ' + req.params.offerID);
    res.status(200).json({ 'resultCode': '1'});
  } else {
    // printLogs('TEST: Offer NOT found BUT STILL REDEEMED: ' + req.params.offerID);
    // res.status(200).json({ 'resultCode': '1'});
    printLogs('ERROR: Offer NOT found: ' + req.params.offerID);
    res.status(404).json({"ErrorCode": "OfferNotFound","ErrorMessage": "Could not find any offer"});
  }
});

router.post('/identifiedSales', function(req, res) {
	printLogs('Request Received: ' + req.url);
	printLogs('payload: %j', req.body);
  var offers = JSON.parse(fs.readFileSync('./offers.json', 'utf8'));
  var offerExists = false;
	for (var i in offers) {
    for (var j in req.body.IdentifiedSales)
    {
      
      if (offers[i]["offerId"] == req.body.IdentifiedSales[j].OfferId) {
        offerExists = true;
      }
    }
	}
  
  if (offerExists){
    printLogs('Success: Identified Sales Received');
    res.status(200).json({ 'resultCode': '1', 'Success': true});
  } else {
    // printLogs('ERROR: Offer NOT found, Identified Sales REJECTED');
    // res.status(404).json({"ErrorCode": "OfferNotFound","ErrorMessage": "Could not find any offer"});
    printLogs('ERROR: Offer NOT found, BUT Identified Sales ACCEPTED');
    res.status(200).json({ 'resultCode': '1', 'Success': true});
  }
});

router.post('/chinacrm/:storeId/:posId', function(req, res) {
	printLogs('Request Received: ' + req.url);
	printLogs('payload: %j', req.body);
  res.status(200).json({ "data": { "_CrmRegId": "2017031500010001", "_key": "POS0001:1607458", "_print": "You have earned 50 points in this transaction!" } });
});

router.post('/login', function(req, res) {
	printLogs('Request Received: ' + req.url);
    res.json({ 'confirmed': true, 'sessionId': 'c87319f6f1035c20bb042853ec074c64' });   
});

router.post('/customUser', function(req, res) {
	customUserName = req.body.username;
	customUserId = req.body.userid;
	printLogs('Request Received: ' + req.url);
    res.json({});
});

router.get('/', function(req, res) {
	res.send(fs.readFileSync('./index.html', 'utf8'));
});

router.get('/listoffers', function(req, res) {
	printLogs('Request Received: ' + req.url);
    res.json(getOffersDetails());
});

router.get('/fiscalReceiptError', function(req, res) {
	printLogs('Request Received: ' + req.url);
  res.status(200).json({ 'resultCode': '1', 'Success': true});
});

router.post('/listoffers', function(req, res) {
	printLogs('Request Received: ' + req.url);
	var offers = readOffersFile();
	var randomCode = req.body.randomCode;
	var offerId = req.body.offerId;
	var displayName = req.body.displayName;
	var promotionXml = req.body.promotionXml
	if (offers.some(function(elem) {
			return (elem.displayName === displayName) && (elem.randomCode === randomCode)
		})) 
	{
		res.status(400).json({ "error": "Offer already exists" });
		return;
	}
	offers.push({
    "randomCode": randomCode,
    "offerId": offerId,
		"displayName": displayName,
		"selected": false
	});
  var offerFilePath = "./offers/" + randomCode + "-" + displayName;
  printLogs('filename: ' + offerFilePath);
	fs.writeFileSync("offers.json", JSON.stringify(offers, null, 4));
	fs.writeFileSync(offerFilePath, promotionXml);
	res.json(getOffersDetails());
});

router.delete('/listoffers/:index', function(req, res) {
	var offers = readOffersFile();
	printLogs('Request Received: ' + req.url);
	var index = req.params.index;
	var offer = offers[index];
	offers.splice(index, 1);
	fs.writeFileSync("offers.json", JSON.stringify(offers, null, 4));
  var offerFilePath = "./offers/" + offer.randomCode + "-" + offer.displayName;
	fs.unlinkSync(offerFilePath);
	res.json(getOffersDetails());
});

router.post('/selectOffer/:index', function(req, res) {
	var offers = readOffersFile();
	printLogs('Request Received: ' + req.url);
	var index = req.params.index;
	for (var i = 0; i < offers.length; i++) {
		offers[i]["selected"] = i == index? true : false;
	}
	fs.writeFileSync("offers.json", JSON.stringify(offers, null, 4));
	res.json(getOffersDetails());
});

function readOffersFile() {
	return JSON.parse(fs.readFileSync('./offers.json', 'utf8'));
}

function getOffersDetails() {
	var offers = JSON.parse(fs.readFileSync('./offers.json', 'utf8'));
	for (var i in offers) {
		var promotionXml = fs.readFileSync('./offers/' + offers[i]["randomCode"] + "-" + offers[i]["displayName"], 'utf8');
		offers[i]['promotionXml'] = promotionXml;
	}
	return offers;
}

function timestamp(){
  function pad(n) {return n<10 ? "0"+n : n}
  d=new Date()
  dash="-"
  colon=":"
  return d.getFullYear()+dash+
  pad(d.getMonth()+1)+dash+
  pad(d.getDate())+" "+
  pad(d.getHours())+colon+
  pad(d.getMinutes())+colon+
  pad(d.getSeconds())
}

function printLogs(arg1,arg2){
  if(arguments.length ==1) {
    console.log(timestamp() + ' ' + arg1); 
    f='';
  } else if(arguments.length ==2)
  {
    console.log(timestamp() + ' ' + arg1,arg2);
    f = JSON.stringify(arg2, null, 4) ;
  } else
  {
    return console.log(timestamp() + 'illegal argument count')
  }
  
  fs.appendFile("log.log", timestamp() + ' ' + arg1 + f + '\r\n', function(err){
    if(err) {
        return console.log(timestamp() + err);
    }
  });
}

app.use('/', router);

// START THE SERVER
// =============================================================================
app.listen(port);
printLogs('CLR Server Simulator running on Port' + port);
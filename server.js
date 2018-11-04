var async = require('async');
var request = require('request');
var xml2js = require('xml2js');

var utc_tz_adjust = 1000 * 2 * 60 * 60;
var lead_text = 'Active threads from last week:';
var forum_path = 'https://www.simplemachines.org/community/';
var cookie = '';
var week_min = 1;
var week_max = 1;
var reply_regex = /^Re: /;

var jar = request.jar();

if ( cookie ) {
    jar.setCookie( cookie, forum_path, function(){} );
}

request = request.defaults({jar:jar});

var now = new Date().getTime();
var topics = {};
var topic_list = [];

async.waterfall( [
    function( cb ) { request.get( { url : forum_path + 'index.php?action=.xml;type=atom;limit=50', encoding : 'binary' }, cb ); },
    function( response, body, cb ) { xml2js.parseString( body, cb ); },
    function( data, cb ) {
        // console.log( require('util').inspect(data, {depth:null}) );

        data.feed.entry.reverse();
        data.feed.entry.forEach( function( entry ) {
            var published = new Date( entry.published.pop() );
            var weeks_ago = 0;
            var day_before = new Date( now + utc_tz_adjust );
            day_before.setUTCHours( 0 );
            day_before.setUTCMinutes( 0 );
            day_before.setUTCSeconds( 0 );
            day_before.setUTCMilliseconds( 0 );

            day_before = new Date( day_before.getTime() - utc_tz_adjust );

            while ( day_before > published ) {
                day_before = new Date( day_before.getTime() - 1000 * 60 * 60 * 24 );

                date_for_determining_day =new Date( day_before.getTime() + utc_tz_adjust );
                if ( date_for_determining_day.getUTCDay() == 0 ) {
                    weeks_ago++;
                }
            }
            if ( weeks_ago < week_min || weeks_ago > week_max ) {
                return;
            }

            var author = entry.author.pop().name.pop();
            var title = entry.title.pop();
            var link = entry.link.pop().$.href;

            title = title.replace( reply_regex, '' );
            link = link.match(/.*topic=\d+/)[0];

            if ( ! topics[link] ) {
                topic_list.push( link );
                topics[link] = { link : link, title : title, authors : [], author_map: {} };
            }

            if ( ! topics[link].author_map[author] ) {
                topics[link].author_map[author] = true;
                topics[link].authors.push( author );
            }

        } );

        cb();
    },
], function( err ) {
    if ( err ) { console.log( err ) }
    else {
        console.log( lead_text + "\n");

        var outputs = topic_list.map( function( link ) {
            var entry = topics[link];
            return entry.title + " (" + entry.authors.join(", ") + ")\n" + entry.link;
        });
        console.log( outputs.join("\n\n"));
    }
} );

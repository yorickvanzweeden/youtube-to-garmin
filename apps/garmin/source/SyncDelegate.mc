import Toybox.Communications;
import Toybox.Application;
import Toybox.Lang;
import Toybox.Media;
import Toybox.PersistedContent;

class GarminSyncDelegate extends Communications.SyncDelegate {

    const FEED_URL = "https://youtube-to-garmin.vercel.app/api/garmin/feed";
    var _pendingItems = [];
    var _nextItem = 0;
    var _feedRevision = 0;
    var _token = null;

    function initialize() {
        SyncDelegate.initialize();
    }

    // Called when the system starts a sync of the app.
    // The app should begin to download songs chosen in the configure
    // sync view .
    function onStartSync() as Void {
        var token = Application.Storage.getValue("deviceToken");
        if (token == null) {
            Communications.notifySyncComplete("Pair this device from the web app first");
            return;
        }
        _token = token;
        var revision = Application.Storage.getValue("revision");
        if (revision == null) {
            revision = 0;
        }
        var options = {
            :method => Communications.HTTP_REQUEST_METHOD_GET,
            :headers => { "Authorization" => "Bearer " + token },
            :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON,
        };
        Communications.makeWebRequest(
            FEED_URL + "?since=" + revision,
            null,
            options,
            method(:onFeed)
        );
    }

    // Called by the system to determine if the app needs to be synced.
    function isSyncNeeded() as Boolean {
        return true;
    }

    // Called when the user chooses to cancel an active sync.
    function onStopSync() as Void {
        Communications.cancelAllRequests();
        Communications.notifySyncComplete(null);
    }

    function onFeed(responseCode as Number, data as Dictionary?) as Void {
        if (responseCode != 200 || data == null) {
            Communications.notifySyncComplete("Unable to read the Garmin audio feed");
            return;
        }
        _pendingItems = data["items"];
        _feedRevision = data["revision"];
        _nextItem = 0;
        downloadNext();
    }

    function downloadNext() as Void {
        if (_pendingItems == null || _nextItem >= _pendingItems.size()) {
            Application.Storage.setValue("revision", _feedRevision);
            Communications.notifySyncComplete(null);
            return;
        }
        var item = _pendingItems[_nextItem];
        if (item["deleted"] == true) {
            var contentRef = new Media.ContentRef(item["id"], Media.CONTENT_TYPE_AUDIO);
            Media.deleteCachedItem(contentRef);
            _nextItem += 1;
            Communications.notifySyncProgress((_nextItem * 100) / _pendingItems.size());
            downloadNext();
            return;
        }
        var options = {
            :method => Communications.HTTP_REQUEST_METHOD_GET,
            :headers => { "Authorization" => "Bearer " + _token },
            :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_AUDIO,
            :mediaEncoding => Media.ENCODING_MP3,
        };
        Communications.makeWebRequest(item["url"], null, options, method(:onAudio));
    }

    function onAudio(responseCode as Number, data as PersistedContent.Iterator?) as Void {
        if (responseCode != 200) {
            Communications.notifySyncComplete("Audio download failed");
            return;
        }
        _nextItem += 1;
        Communications.notifySyncProgress((_nextItem * 100) / _pendingItems.size());
        downloadNext();
    }
}

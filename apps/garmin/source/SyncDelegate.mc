import Toybox.Communications;
import Toybox.Application;
import Toybox.Lang;
import Toybox.Media;
import Toybox.PersistedContent;

class GarminSyncDelegate extends Communications.SyncDelegate {

    const FEED_URL = "https://youtube-to-garmin.vercel.app/api/garmin/feed";
    const PAIR_START_URL = "https://youtube-to-garmin.vercel.app/api/garmin/pair/start";
    const PAIR_STATUS_URL = "https://youtube-to-garmin.vercel.app/api/garmin/pair/status";
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
            var pairingId = Application.Storage.getValue("pairingId");
            var pairingSecret = Application.Storage.getValue("pairingSecret");
            if (pairingId != null && pairingSecret != null) {
                pollPairing(pairingId, pairingSecret);
            } else {
                beginPairing();
            }
            return;
        }
        _token = token;
        beginFeed(token);
    }

    function beginPairing() as Void {
        var options = {
            :method => Communications.HTTP_REQUEST_METHOD_POST,
            :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON,
        };
        Communications.makeWebRequest(PAIR_START_URL, null, options, method(:onPairStart));
    }

    function onPairStart(responseCode as Number, data as Dictionary?) as Void {
        if (responseCode != 201 || data == null) {
            Communications.notifySyncComplete("Unable to start device pairing");
            return;
        }
        Application.Storage.setValue("pairingId", data["pairingId"]);
        Application.Storage.setValue("pairingSecret", data["secret"]);
        Communications.notifySyncComplete("Pairing code: " + data["code"] + " — enter it at /pair");
    }

    function pollPairing(pairingId as String, pairingSecret as String) as Void {
        var options = {
            :method => Communications.HTTP_REQUEST_METHOD_GET,
            :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON,
        };
        Communications.makeWebRequest(
            PAIR_STATUS_URL + "?pairingId=" + pairingId + "&secret=" + pairingSecret,
            null,
            options,
            method(:onPairStatus)
        );
    }

    function onPairStatus(responseCode as Number, data as Dictionary?) as Void {
        if (responseCode != 200 || data == null) {
            Communications.notifySyncComplete("Unable to check pairing status");
            return;
        }
        if (data["status"] != "approved") {
            Communications.notifySyncComplete("Pairing is waiting for approval at /pair");
            return;
        }
        var token = data["deviceToken"];
        if (token == null) {
            Communications.notifySyncComplete("Pairing response did not include a device token");
            return;
        }
        Application.Storage.setValue("deviceToken", token);
        Application.Storage.deleteValue("pairingId");
        Application.Storage.deleteValue("pairingSecret");
        _token = token;
        beginFeed(token);
    }

    function beginFeed(token as String) as Void {
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

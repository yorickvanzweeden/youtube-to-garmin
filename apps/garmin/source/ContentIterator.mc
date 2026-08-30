import Toybox.Lang;
import Toybox.Media;

class GarminContentIterator extends Media.ContentIterator {

    var _contentRefs = [];
    var _index = 0;

    function initialize() {
        ContentIterator.initialize();
        var refs = Media.getContentRefIter({
            :contentType => Media.CONTENT_TYPE_AUDIO,
            :shuffle => false
        });
        var contentRef = refs.next();
        while (contentRef != null) {
            _contentRefs.add(contentRef);
            contentRef = refs.next();
        }
    }

    // Determine if the the current track can be skipped.
    function canSkip() as Boolean {
        return true;
    }

    // Get the current media content object.
    function get() as Content? {
        if (_index < 0 || _index >= _contentRefs.size()) {
            return null;
        }
        return Media.getCachedContentObj(_contentRefs[_index]);
    }

    // Get the current media content playback profile
    function getPlaybackProfile() as PlaybackProfile? {
        var profile = new Media.PlaybackProfile();
        profile.attemptSkipAfterThumbsDown = false;
        profile.playbackControls = [
            PLAYBACK_CONTROL_SKIP_BACKWARD,
            PLAYBACK_CONTROL_PLAYBACK,
            PLAYBACK_CONTROL_SKIP_FORWARD
        ];
        profile.playbackNotificationThreshold = 1;
        profile.requirePlaybackNotification = false;
        profile.skipPreviousThreshold = null;
        return profile;
    }

    // Get the next media content object.
    function next() as Content? {
        if (_index < _contentRefs.size()) {
            _index += 1;
        }
        return get();
    }

    // Get the next media content object without incrementing the iterator.
    function peekNext() as Content? {
        if (_index + 1 >= _contentRefs.size()) {
            return null;
        }
        return Media.getCachedContentObj(_contentRefs[_index + 1]);
    }

    // Get the previous media content object without decrementing the iterator.
    function peekPrevious() as Content? {
        if (_index <= 0) {
            return null;
        }
        return Media.getCachedContentObj(_contentRefs[_index - 1]);
    }

    // Get the previous media content object.
    function previous() as Content? {
        if (_index > 0) {
            _index -= 1;
        }
        return get();
    }

    // Determine if playback is currently set to shuffle.
    function shuffling() as Boolean {
        return false;
    }

}

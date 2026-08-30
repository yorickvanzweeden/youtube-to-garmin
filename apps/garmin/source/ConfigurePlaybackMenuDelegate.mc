import Toybox.Application;
import Toybox.Lang;
import Toybox.Media;
import Toybox.WatchUi;

class GarminConfigurePlaybackMenuDelegate extends WatchUi.Menu2InputDelegate {

    function initialize() {
        Menu2InputDelegate.initialize();
    }

    function onSelect(item) as Void {
        var playlist = Application.Storage.getValue("playlist");
        if (playlist == null) {
            playlist = {};
        }
        var checkbox = item as WatchUi.CheckboxMenuItem;
        var id = item.getId() as Lang.String;
        if (checkbox.isChecked()) {
            playlist[id] = true;
        } else {
            playlist.remove(id);
        }
        Application.Storage.setValue("playlist", playlist);
    }

    function onDone() as Void {
        Media.startPlayback(null);
    }

    function onBack() as Void {
        WatchUi.popView(WatchUi.SLIDE_IMMEDIATE);
    }

}

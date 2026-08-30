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
            playlist = [];
        }
        var checkbox = item as WatchUi.CheckboxMenuItem;
        var id = item.getId() as Lang.String;
        if (checkbox.isChecked()) {
            if (!containsId(playlist, id)) {
                playlist.add(id);
            }
        } else {
            var index = findId(playlist, id);
            if (index >= 0) {
                playlist.remove(index);
            }
        }
        Application.Storage.setValue("playlist", playlist);
    }

    function onDone() as Void {
        Media.startPlayback(null);
    }

    function onBack() as Void {
        WatchUi.popView(WatchUi.SLIDE_IMMEDIATE);
    }

    function containsId(playlist, id) as Boolean {
        return findId(playlist, id) >= 0;
    }

    function findId(playlist, id) as Number {
        for (var index = 0; index < playlist.size(); ++index) {
            if (playlist[index].equals(id)) {
                return index;
            }
        }
        return -1;
    }
}

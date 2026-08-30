import Toybox.Application;
import Toybox.Communications;
import Toybox.Lang;
import Toybox.Media;
import Toybox.WatchUi;

class GarminConfigurePlaybackMenuDelegate extends WatchUi.Menu2InputDelegate {

    function initialize() {
        Menu2InputDelegate.initialize();
    }

    function onSelect(item) as Void {
        if (item.getId() == :sync_now) {
            Communications.startSync();
            return;
        }
        var checkbox = item as WatchUi.CheckboxMenuItem;
        var id = item.getId() as Lang.String;
        if (checkbox.isChecked()) {
            Application.Storage.setValue("selectedTrack", id);
        } else {
            Application.Storage.deleteValue("selectedTrack");
        }
    }

    function onDone() as Void {
        Media.startPlayback(null);
    }

    function onBack() as Void {
        WatchUi.popView(WatchUi.SLIDE_IMMEDIATE);
    }

}

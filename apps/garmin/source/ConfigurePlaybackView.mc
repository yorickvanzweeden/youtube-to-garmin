import Toybox.Graphics;
import Toybox.Application;
import Toybox.Lang;
import Toybox.Media;
import Toybox.WatchUi;

class GarminConfigurePlaybackView extends WatchUi.View {

    var _menuShown = false;

    function initialize() {
        View.initialize();
    }

    // Load your resources here
    function onLayout(dc as Dc) as Void {
        setLayout(Rez.Layouts.ConfigurePlaybackLayout(dc));
    }

    // Called when this View is brought to the foreground. Restore
    // the state of this View and prepare it to be shown. This includes
    // loading resources into memory.
    function onShow() as Void {
        if (_menuShown) {
            WatchUi.popView(WatchUi.SLIDE_IMMEDIATE);
            return;
        }

        var menu = new WatchUi.CheckboxMenu({:title => "Play Downloads"});
        var selectedTrack = Application.Storage.getValue("selectedTrack");
        var cachedIds = Application.Storage.getValue("cachedIds") as Dictionary;
        var keys = cachedIds == null ? [] : cachedIds.keys();
        for (var index = 0; index < keys.size(); index += 1) {
            var ref = new Media.ContentRef(cachedIds[keys[index]], Media.CONTENT_TYPE_AUDIO);
            var content = Media.getCachedContentObj(ref);
            if (content != null) {
                var metadata = content.getMetadata();
                var title = metadata.title;
                if (title == null || title.length() == 0) {
                    title = "Untitled audio";
                }
                menu.addItem(new WatchUi.CheckboxMenuItem(
                    title,
                    null,
                    ref.getId() as Lang.String,
                    selectedTrack == (ref.getId() as Lang.String),
                    {}
                ));
            }
        }
        WatchUi.pushView(menu, new GarminConfigurePlaybackMenuDelegate(), WatchUi.SLIDE_IMMEDIATE);
        _menuShown = true;
    }

    // Update the view
    function onUpdate(dc as Dc) as Void {
        // Call the parent onUpdate function to redraw the layout
        View.onUpdate(dc);
    }

    // Called when this View is removed from the screen. Save the
    // state of this View here. This includes freeing resources from
    // memory.
    function onHide() as Void {
    }

}

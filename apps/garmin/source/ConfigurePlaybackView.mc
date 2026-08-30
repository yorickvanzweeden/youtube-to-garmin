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

        var refs = Media.getContentRefIter({
            :contentType => Media.CONTENT_TYPE_AUDIO,
            :shuffle => false
        });
        var menu = new WatchUi.CheckboxMenu({:title => "Play Downloads"});
        var selectedTrack = Application.Storage.getValue("selectedTrack");
        var ref = refs.next();
        while (ref != null) {
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
            ref = refs.next();
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

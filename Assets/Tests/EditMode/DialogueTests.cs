using System.Collections;
using System.Linq;
using System.Reflection;
using Febucci.TextAnimatorForUnity;
using KwGame.View;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.UIElements;

namespace KwGame.Tests
{
    public sealed class DialogueTests
    {
        const BindingFlags Private = BindingFlags.Instance | BindingFlags.NonPublic;
        GameObject game;
        GameController controller;
        AnimatedLabel label;
        PanelSettings panelSettings;

        [SetUp]
        public void Setup()
        {
            game = new GameObject("Dialogue test");
            controller = game.AddComponent<GameController>();
            Call("BuildUi");
            label = (AnimatedLabel)Get("dlgText");
            panelSettings = ((UIDocument)Get("doc")).panelSettings;
        }

        [TearDown]
        public void Cleanup()
        {
            if (game != null) Object.DestroyImmediate(game);
            if (panelSettings != null) Object.DestroyImmediate(panelSettings);
        }

        [Test]
        public void FirstInputRevealsAndSameFrameInputCannotAdvance()
        {
            var wait = BeginLine("한 글자씩 나타나는 충분히 긴 대사입니다.");
            Assert.That(label.Typewriter.IsShowingText, Is.True);
            Call("RequestAdvance");
            Assert.That(label.Typewriter.IsShowingText, Is.False);
            Assert.That(label.Characters.Take(label.CharactersCount).All(c => c.isVisible), Is.True);
            Assert.That((bool)Get("clicked"), Is.False);
            Call("RequestAdvance");
            Assert.That((bool)Get("clicked"), Is.False);
            Assert.That(wait.MoveNext(), Is.True);

            Set("advanceFrame", Time.frameCount - 1);
            Call("RequestAdvance");
            Assert.That((bool)Get("clicked"), Is.True);
            Assert.That(wait.MoveNext(), Is.False);
        }

        [Test]
        public void RepeatedTextRestartsTheRevealAfterThePreviousLine()
        {
            var wait = BeginLine("동일한 대사도 다시 타이핑합니다.");
            Call("RequestAdvance");
            Set("advanceFrame", Time.frameCount - 1);
            Call("RequestAdvance");
            Assert.That(wait.MoveNext(), Is.False);
            BeginLine("동일한 대사도 다시 타이핑합니다.");
            Assert.That(label.Typewriter.IsShowingText, Is.True);
            Assert.That(label.Characters.Take(label.CharactersCount).Any(c => !c.isVisible), Is.True);
        }

        [Test]
        public void CompletedDialogueNeedsOnlyOneInputToAdvance()
        {
            var wait = BeginLine("완료된 대사입니다.");
            Call("CompleteDialogueText");
            Call("RequestAdvance");
            Assert.That((bool)Get("clicked"), Is.True);
            Assert.That(wait.MoveNext(), Is.False);
        }

        [Test]
        public void ModalWaitStillAdvancesWithOneInput()
        {
            label.Typewriter.ShowText("이전 대사");
            label.Typewriter.StartShowingText(true);
            var wait = (IEnumerator)Call("WaitClick", false);
            Assert.That(wait.MoveNext(), Is.True);
            Set("waitFrame", Time.frameCount - 1);
            Call("RequestAdvance");
            Assert.That((bool)Get("clicked"), Is.True);
            Assert.That(wait.MoveNext(), Is.False);
        }

        [Test]
        public void AutoSkipCompletesTextWithoutWaitingForAnInput()
        {
            controller.autoSkipDialog = true;
            var wait = BeginLine("데모에서 모든 글자가 즉시 표시됩니다.");
            Assert.That(label.Typewriter.IsShowingText, Is.False);
            Assert.That(label.Characters.Take(label.CharactersCount).All(c => c.isVisible), Is.True);
            Assert.That(wait.MoveNext(), Is.False);
        }

        IEnumerator BeginLine(string text)
        {
            var say = (IEnumerator)Call("Say", "nar", null, text, null);
            Assert.That(say.MoveNext(), Is.True);
            var wait = (IEnumerator)say.Current;
            Assert.That(wait.MoveNext(), Is.True);
            Set("waitFrame", Time.frameCount - 1);
            return wait;
        }

        object Get(string name) => typeof(GameController).GetField(name, Private).GetValue(controller);
        void Set(string name, object value) => typeof(GameController).GetField(name, Private).SetValue(controller, value);
        object Call(string name, params object[] arguments) => typeof(GameController).GetMethod(name, Private).Invoke(controller, arguments);
    }
}
